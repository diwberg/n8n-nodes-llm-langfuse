
import {
    type INodeType,
    type INodeTypeDescription,
    type ISupplyDataFunctions,
    type SupplyData,
    type ILoadOptionsFunctions,
    type INodePropertyOptions,
    jsonParse,
} from 'n8n-workflow';
import { ChatOpenAI } from '@langchain/openai';
import { CallbackHandler } from 'langfuse-langchain';
import { N8nLlmTracing } from '../utils/N8nLlmTracing';
import { getProxyAgent } from '../utils/httpProxyAgent';


export class LmChatOpenAiLangfuse implements INodeType {
    methods = {
        loadOptions: {
            async listModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const credentials = await this.getCredentials('openAiLangfuseApi');
                const apiKey = credentials.apiKey as string;
                const baseUrl = 'https://api.openai.com/v1';

                try {
                    const response = await fetch(`${baseUrl}/models`, {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                        }
                    });
                    const body = await response.json() as { data: { id: string }[] };

                    if (!body.data) return [];

                    return body.data
                        .filter(m => !m.id.includes('gpt-3.5-turbo-0301') && !m.id.match(/^gpt-3.5-turbo-(0613|16k-0613)$/))
                        .map(m => ({
                            name: m.id,
                            value: m.id,
                        }));
                } catch {
                    return [];
                }
            },
        },
    };

    description: INodeTypeDescription = {
        displayName: 'Langfuse Chat Model (OpenAI)',
        name: 'lmChatOpenAiLangfuse',
        icon: { light: 'file:../../credentials/openai-langfuse.svg', dark: 'file:../../credentials/openai-langfuse-dark.svg' },
        group: ['transform'],
        version: 1,
        description: 'OpenAI Chat Model with Langfuse Tracing',
        defaults: {
            name: 'Langfuse Chat Model (OpenAI)',
        },
        codex: {
            categories: ['AI'],
            subcategories: {
                AI: ['Language Models', 'Root Nodes'],
            },
            resources: {
                primaryDocumentation: [
                    {
                        url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.lmchatopenai/',
                    },
                ],
            },
        },
        inputs: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outputs: ['ai_languageModel' as any],
        outputNames: ['Model'],
        credentials: [
            {
                name: 'openAiLangfuseApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Model Name or ID',
                name: 'model',
                type: 'options',
                description: 'The model to use. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                typeOptions: {
                    loadOptionsMethod: 'listModels',
                },
                default: '',
            },
            {
                displayName: 'OpenAI Options',
                name: 'openAiOptions',
                type: 'collection',
                placeholder: 'Add Options',
                default: {},
                options: [
                    {
                        displayName: 'Frequency Penalty',
                        name: 'frequency_penalty',
                        type: 'number',
                        typeOptions: {
                            minValue: -2,
                            maxValue: 2,
                        },
                        default: 0,
                        description: 'Penalizes new tokens based on their existing frequency in the text so far',
                    },
                    {
                        displayName: 'Max Retries',
                        name: 'max_retries',
                        type: 'number',
                        default: 3,
                        description: 'Maximum number of retries to attempt',
                    },
                    {
                        displayName: 'Maximum Number of Tokens',
                        name: 'max_tokens',
                        type: 'number',
                        typeOptions: {
                            minValue: 1,
                        },
                        default: -1,
                        description: 'The maximum number of tokens to generate in the completion',
                    },
                    {
                        displayName: 'Presence Penalty',
                        name: 'presence_penalty',
                        type: 'number',
                        typeOptions: {
                            minValue: -2,
                            maxValue: 2,
                        },
                        default: 0,
                        description: 'Penalizes new tokens based on whether they appear in the text so far',
                    },
                    {
                        displayName: 'Sampling Temperature',
                        name: 'temperature',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 2,
                        },
                        default: 1,
                        description: 'Controls randomness: Higher values (e.g., 0.8) make output more random, lower values (e.g., 0.2) make it more focused and deterministic',
                    },
                    {
                        displayName: 'Timeout',
                        name: 'timeout',
                        type: 'number',
                        default: 60000,
                        description: 'Maximum request time in milliseconds',
                    },
                    {
                        displayName: 'Top P',
                        name: 'top_p',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 1,
                        },
                        default: 1,
                        description: 'Nucleus sampling: filters text to the top P probability mass',
                    },
                ]
            },
            {
                displayName: 'Langfuse Metadata',
                name: 'langfuseMetadata',
                type: 'collection',
                placeholder: 'Add Metadata',
                default: {},
                options: [
                    {
                        displayName: 'Custom Metadata (JSON)',
                        name: 'customMetadata',
                        type: 'json',
                        default: `{\n    "project": "example-project"\n}`,
                        description: "Optional. Pass extra metadata to be attached to Langfuse traces."
                    },
                    {
                        displayName: 'Session ID',
                        name: 'sessionId',
                        type: 'string',
                        default: '',
                        description: 'Session ID for Langfuse traces',
                    },
                    {
                        displayName: 'User ID',
                        name: 'userId',
                        type: 'string',
                        default: '',
                        description: 'User ID for Langfuse traces',
                    },
                ]
            },
        ],
        usableAsTool: true,
    };

    async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
        const credentials = await this.getCredentials('openAiLangfuse');

        // --- Langfuse Config ---
        const langfuseSecretKey = credentials.langfuseSecretKey as string;
        const langfusePublicKey = credentials.langfusePublicKey as string;
        const langfuseBaseUrl = credentials.langfuseBaseUrl as string;

        // Metadata extraction
        const {
            sessionId,
            userId,
            customMetadata: customMetadataRaw = {},
        } = this.getNodeParameter('langfuseMetadata', itemIndex, {}) as {
            sessionId: string;
            userId?: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            customMetadata?: string | Record<string, any>;
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let customMetadata: Record<string, any> = {};

        if (typeof customMetadataRaw === 'string') {
            try {
                customMetadata = customMetadataRaw.trim()
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? jsonParse<Record<string, any>>(customMetadataRaw)
                    : {};
            } catch {
                customMetadata = { _raw: customMetadataRaw }; // fallback
            }
        } else if (customMetadataRaw && typeof customMetadataRaw === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            customMetadata = customMetadataRaw as Record<string, any>;
        }

        const lfHandler = new CallbackHandler({
            baseUrl: langfuseBaseUrl.replace(/\/$/, ""),
            publicKey: langfusePublicKey,
            secretKey: langfuseSecretKey,
            sessionId,
            userId,
            flushAt: 1,
        });

        const n8nHandler = new N8nLlmTracing(this);

        // --- Model Config ---
        // --- Model Config ---
        const modelName = this.getNodeParameter('model', itemIndex) as string;

        const openAiOptions = this.getNodeParameter('openAiOptions', itemIndex, {}) as {
            temperature?: number;
            top_p?: number;
            frequency_penalty?: number;
            presence_penalty?: number;
            max_tokens?: number;
            timeout?: number;
            max_retries?: number;
        };

        const apiKey = credentials.apiKey as string;
        const baseUrl = 'https://api.openai.com/v1';

        // Use n8n's proxy if configured
        const proxyAgent = getProxyAgent(baseUrl);

        const model = new ChatOpenAI({
            apiKey, // Standard property name for newer SDKs
            modelName,
            temperature: openAiOptions.temperature,
            topP: openAiOptions.top_p,
            frequencyPenalty: openAiOptions.frequency_penalty,
            presencePenalty: openAiOptions.presence_penalty,
            maxTokens: openAiOptions.max_tokens,
            timeout: openAiOptions.timeout,
            maxRetries: openAiOptions.max_retries,
            metadata: customMetadata,
            configuration: {
                baseURL: baseUrl,
                httpAgent: proxyAgent,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            callbacks: [lfHandler, n8nHandler],
        });

        return {
            response: model,
        };
    }
}
