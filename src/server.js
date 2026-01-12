/**
 * Express Server - Anthropic-compatible API
 * Proxies to Google Cloud Code via Antigravity
 * Supports multi-account load balancing
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendMessage, sendMessageStream, listModels, getModelQuotas, getSubscriptionTier } from './cloudcode/index.js';
import { mountWebUI } from './webui/index.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { forceRefresh } from './auth/token-extractor.js';
import { REQUEST_BODY_LIMIT, DEFAULT_PORT } from './constants.js';
import { AccountManager } from './account-manager/index.js';
import { formatDuration } from './utils/helpers.js';
import { logger } from './utils/logger.js';
import usageStats from './modules/usage-stats.js';

// Parse fallback flag directly from command line args to avoid circular dependency
const args = process.argv.slice(2);
const FALLBACK_ENABLED = args.includes('--fallback') || process.env.FALLBACK === 'true';

/**
 * Standard error parser for API responses
 */
function parseError(error) {
    let errorType = 'api_error';
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.response) {
        statusCode = error.response.status || 500;
        if (error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error.message || errorMessage;
            errorType = error.response.data.error.type || errorType;
        }
    } else if (error.message && error.message.toLowerCase().includes('quota')) {
        errorType = 'rate_limit_error';
        statusCode = 429;
    }

    return { errorType, statusCode, errorMessage };
}

class ProxyServer {
    constructor(port = config.port || DEFAULT_PORT) {
        this.port = port;
        this.app = express();
        this.server = null;
        this.connections = new Set();
        this.accountManager = new AccountManager();
        this.isInitialized = false;
        this.initPromise = null;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
        usageStats.setupMiddleware(this.app);

        // Request logging middleware
        this.app.use((req, res, next) => {
            if (req.path === '/api/event_logging/batch') {
                if (logger.isDebugEnabled) {
                    logger.debug(`[${req.method}] ${req.path}`);
                }
            } else {
                logger.info(`[${req.method}] ${req.path}`);
            }
            next();
        });
    }

    setupRoutes() {
        mountWebUI(this.app, __dirname, this.accountManager);

        // Health check
        this.app.get('/health', async (req, res) => {
            try {
                await this.ensureInitialized();
                const start = Date.now();
                const status = this.accountManager.getStatus();
                const allAccounts = this.accountManager.getAllAccounts();

                const accountDetails = await Promise.allSettled(
                    allAccounts.map(async (account) => {
                        const activeModelLimits = Object.entries(account.modelRateLimits || {})
                            .filter(([_, limit]) => limit.isRateLimited && limit.resetTime > Date.now());
                        const isRateLimited = activeModelLimits.length > 0;
                        const soonestReset = activeModelLimits.length > 0
                            ? Math.min(...activeModelLimits.map(([_, l]) => l.resetTime))
                            : null;

                        const baseInfo = {
                            email: account.email,
                            lastUsed: account.lastUsed ? new Date(account.lastUsed).toISOString() : null,
                            modelRateLimits: account.modelRateLimits || {},
                            rateLimitCooldownRemaining: soonestReset ? Math.max(0, soonestReset - Date.now()) : 0
                        };

                        if (account.isInvalid) {
                            return { ...baseInfo, status: 'invalid', error: account.invalidReason, models: {} };
                        }

                        try {
                            const token = await this.accountManager.getTokenForAccount(account);
                            const quotas = await getModelQuotas(token);
                            const formattedQuotas = {};
                            for (const [modelId, info] of Object.entries(quotas)) {
                                formattedQuotas[modelId] = {
                                    remaining: info.remainingFraction !== null ? `${Math.round(info.remainingFraction * 100)}%` : 'N/A',
                                    remainingFraction: info.remainingFraction,
                                    resetTime: info.resetTime || null
                                };
                            }
                            return { ...baseInfo, status: isRateLimited ? 'rate-limited' : 'ok', models: formattedQuotas };
                        } catch (error) {
                            return { ...baseInfo, status: 'error', error: error.message, models: {} };
                        }
                    })
                );

                res.json({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    latencyMs: Date.now() - start,
                    summary: status.summary,
                    counts: {
                        total: status.total,
                        available: status.available,
                        rateLimited: status.rateLimited,
                        invalid: status.invalid
                    },
                    accounts: accountDetails.map((result, index) => result.status === 'fulfilled' ? result.value : {
                        email: allAccounts[index].email,
                        status: 'error',
                        error: result.reason?.message || 'Unknown error'
                    })
                });
            } catch (error) {
                res.status(503).json({ status: 'error', error: error.message });
            }
        });

        // Account limits
        this.app.get('/account-limits', async (req, res) => {
            try {
                await this.ensureInitialized();
                const allAccounts = this.accountManager.getAllAccounts();
                const includeHistory = req.query.includeHistory === 'true';

                const results = await Promise.allSettled(
                    allAccounts.map(async (account) => {
                        if (account.isInvalid) return { email: account.email, status: 'invalid', error: account.invalidReason, models: {} };
                        try {
                            const token = await this.accountManager.getTokenForAccount(account);
                            const [quotas, subscription] = await Promise.all([getModelQuotas(token), getSubscriptionTier(token)]);
                            account.subscription = { tier: subscription.tier, projectId: subscription.projectId, detectedAt: Date.now() };
                            account.quota = { models: quotas, lastChecked: Date.now() };
                            this.accountManager.saveToDisk().catch(err => logger.error('[Server] Failed to save account data:', err));
                            return { email: account.email, status: 'ok', subscription: account.subscription, models: quotas };
                        } catch (error) {
                            return { email: account.email, status: 'error', error: error.message, subscription: account.subscription || { tier: 'unknown', projectId: null }, models: {} };
                        }
                    })
                );

                const accountLimits = results.map((result, index) => result.status === 'fulfilled' ? result.value : { email: allAccounts[index].email, status: 'error', error: result.reason?.message || 'Unknown error', models: {} });
                const allModelIds = new Set();
                accountLimits.forEach(acc => Object.keys(acc.models || {}).forEach(m => allModelIds.add(m)));
                const sortedModels = Array.from(allModelIds).sort();

                const accountStatus = this.accountManager.getStatus();
                const accountMetadataMap = new Map(accountStatus.accounts.map(a => [a.email, a]));

                res.json({
                    timestamp: new Date().toLocaleString(),
                    totalAccounts: allAccounts.length,
                    models: sortedModels,
                    accounts: accountLimits.map(acc => {
                        const metadata = accountMetadataMap.get(acc.email) || {};
                        return {
                            ...acc,
                            source: metadata.source || 'unknown',
                            enabled: metadata.enabled !== false,
                            projectId: metadata.projectId || null,
                            isInvalid: metadata.isInvalid || false,
                            invalidReason: metadata.invalidReason || null,
                            lastUsed: metadata.lastUsed || null,
                            modelRateLimits: metadata.modelRateLimits || {},
                            subscription: acc.subscription || metadata.subscription || { tier: 'unknown', projectId: null },
                            limits: Object.fromEntries(sortedModels.map(modelId => {
                                const quota = acc.models?.[modelId];
                                return [modelId, quota ? {
                                    remaining: quota.remainingFraction !== null ? `${Math.round(quota.remainingFraction * 100)}%` : 'N/A',
                                    remainingFraction: quota.remainingFraction,
                                    resetTime: quota.resetTime || null
                                } : null];
                            }))
                        };
                    }),
                    history: includeHistory ? usageStats.getHistory() : undefined
                });
            } catch (error) {
                res.status(500).json({ status: 'error', error: error.message });
            }
        });

        this.app.post('/refresh-token', async (req, res) => {
            try {
                await this.ensureInitialized();
                this.accountManager.clearTokenCache();
                this.accountManager.clearProjectCache();
                const token = await forceRefresh();
                res.json({ status: 'ok', tokenPrefix: token.substring(0, 10) + '...' });
            } catch (error) {
                res.status(500).json({ status: 'error', error: error.message });
            }
        });

        this.app.get('/v1/models', async (req, res) => {
            try {
                await this.ensureInitialized();
                const account = this.accountManager.pickNext();
                if (!account) return res.status(503).json({ type: 'error', error: { type: 'api_error', message: 'No accounts available' } });
                const token = await this.accountManager.getTokenForAccount(account);
                res.json(await listModels(token));
            } catch (error) {
                res.status(500).json({ type: 'error', error: { type: 'api_error', message: error.message } });
            }
        });

        this.app.post('/v1/messages', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { model, messages, stream } = req.body;
                let requestedModel = model || 'claude-3-5-sonnet-20241022';
                const modelMapping = config.modelMapping || {};
                if (modelMapping[requestedModel]?.mapping) requestedModel = modelMapping[requestedModel].mapping;

                if (this.accountManager.isAllRateLimited(requestedModel)) {
                    this.accountManager.resetAllRateLimits();
                }

                if (stream) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.flushHeaders();
                    try {
                        for await (const event of sendMessageStream(req.body, this.accountManager, FALLBACK_ENABLED)) {
                            res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
                        }
                        res.end();
                    } catch (e) {
                        const { errorType, errorMessage } = parseError(e);
                        res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: { type: errorType, message: errorMessage } })}\n\n`);
                        res.end();
                    }
                } else {
                    res.json(await sendMessage(req.body, this.accountManager, FALLBACK_ENABLED));
                }
            } catch (error) {
                const { errorType, statusCode, errorMessage } = parseError(error);
                res.status(statusCode).json({ type: 'error', error: { type: errorType, message: errorMessage } });
            }
        });

        usageStats.setupRoutes(this.app);
        this.app.use('*', (req, res) => res.status(404).json({ type: 'error', error: { type: 'not_found_error', message: `Endpoint ${req.method} ${req.originalUrl} not found` } }));
    }

    async ensureInitialized() {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;
        this.initPromise = (async () => {
            try {
                await this.accountManager.initialize();
                this.isInitialized = true;
                logger.success(`[Server] Account pool initialized`);
            } catch (error) {
                this.initPromise = null;
                throw error;
            }
        })();
        return this.initPromise;
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, (err) => {
                if (err) return reject(err);
                logger.success(`Server started on port ${this.port}`);
                resolve(this.server);
            });

            this.server.on('connection', (socket) => {
                this.connections.add(socket);
                socket.on('close', () => {
                    this.connections.delete(socket);
                });
            });
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                // Kill all active connections
                for (const socket of this.connections) {
                    socket.destroy();
                }
                this.connections.clear();

                this.server.close(() => {
                    this.server = null;
                    logger.info(`Server stopped on port ${this.port}`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

export { ProxyServer };
export default ProxyServer;

