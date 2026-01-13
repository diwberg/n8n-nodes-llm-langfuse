
import {
    type INodeType,
    type INodeTypeDescription,
    type ISupplyDataFunctions,
    type SupplyData,
    type ILoadOptionsFunctions,
    type INodePropertyOptions,
    jsonParse,
} from 'n8n-workflow';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { CallbackHandler } from 'langfuse-langchain';
import { N8nLlmTracing } from '../utils/N8nLlmTracing';


export class LmChatGoogleLangfuse implements INodeType {
    methods = {
        loadOptions: {
            async listModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                // Get credentials
                const credentials = await this.getCredentials('googleLangfuseApi');
                const apiKey = credentials.apiKey;

                try {
                    // Manual fetch to list models
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    const body = await response.json() as { models: { name: string; displayName?: string }[] };

                    if (!body.models) {
                        return [];
                    }

                    // Filter and map
                    return body.models
                        .filter(m => m.name.includes('models/gemini'))
                        .map(m => {
                            const value = m.name.replace('models/', '');
                            const name = m.displayName ? `${m.displayName} (${value})` : value;
                            return {
                                name,
                                value,
                            };
                        });
                } catch {
                    // eslint-disable-next-line no-console
                    console.error('Error loading gemini models');
                    return [];
                }
            },
        },
    };

    description: INodeTypeDescription = {
        displayName: 'Langfuse Chat Model (Google Gemini)',
        name: 'lmChatGoogleLangfuse',
        icon: { light: 'file:../../credentials/gemini-langfuse.svg', dark: 'file:../../credentials/gemini-langfuse-dark.svg' },
        group: ['transform'],
        version: 1,
        description: 'Google Gemini Chat Model with Langfuse Tracing',
        defaults: {
            name: 'Langfuse Chat Model (Google)',
        },
        codex: {
            categories: ['AI'],
            subcategories: {
                AI: ['Language Models', 'Root Nodes'],
            },
            resources: {
                primaryDocumentation: [
                    {
                        url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.lmchatgoogle/',
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
                name: 'googleLangfuseApi',
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
                displayName: 'Gemini Options',
                name: 'geminiOptions',
                type: 'collection',
                placeholder: 'Add Options',
                default: {},
                options: [
                    {
                        displayName: 'Temperature',
                        name: 'temperature',
                        type: 'number',
                        default: 0.7,
                        description: 'Controls randomness',
                    },
                    {
                        displayName: 'Max Output Tokens',
                        name: 'maxOutputTokens',
                        type: 'number',
                        default: 2048,
                        description: 'The maximum value of tokens to generate',
                    },
                    {
                        displayName: 'Top K',
                        name: 'topK',
                        type: 'number',
                        default: 40,
                        description: 'The maximum number of tokens to consider when sampling',
                    },
                    {
                        displayName: 'Top P',
                        name: 'topP',
                        type: 'number',
                        default: 0.95,
                        description: 'The maximum cumulative probability of tokens to consider when sampling',
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
        const credentials = await this.getCredentials('googleLangfuseApi');

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

        const geminiOptions = this.getNodeParameter('geminiOptions', itemIndex, {}) as {
            temperature?: number;
            maxOutputTokens?: number;
            topK?: number;
            topP?: number;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
        };

        const apiKey = credentials.apiKey as string;

        const model = new ChatGoogleGenerativeAI({
            apiKey,
            modelName,
            temperature: geminiOptions.temperature,
            maxOutputTokens: geminiOptions.maxOutputTokens,
            topK: geminiOptions.topK,
            topP: geminiOptions.topP,
            callbacks: [lfHandler, n8nHandler],
            metadata: customMetadata,
        });

        return {
            response: model,
        };
    }
}
