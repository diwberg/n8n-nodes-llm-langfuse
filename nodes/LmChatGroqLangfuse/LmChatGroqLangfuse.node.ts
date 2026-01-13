/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
    type INodeType,
    type INodeTypeDescription,
    type ISupplyDataFunctions,
    type SupplyData,
    type ILoadOptionsFunctions,
    type INodePropertyOptions,
    jsonParse,
} from 'n8n-workflow';
import { CallbackHandler } from 'langfuse-langchain';
import { N8nLlmTracing } from '../utils/N8nLlmTracing';
import { ChatGroq } from "@langchain/groq";

export class LmChatGroqLangfuse implements INodeType {
    methods = {
        loadOptions: {
            async listModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const credentials = await this.getCredentials('groqLangfuse');
                const apiKey = credentials.apiKey as string;
                const baseUrl = "https://api.groq.com/openai/v1" as string;

                try {
                    const response = await fetch(`${baseUrl}/models`, {
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                        }
                    });
                    const body = await response.json() as { data: { id: string }[] };

                    if (!body.data) return [];

                    return body.data.map(m => ({
                        name: m.id,
                        value: m.id,
                    }));
                } catch (error) {
                    return [];
                }
            },
        },
    };

    description: INodeTypeDescription = {
        displayName: 'Langfuse Chat Model (Groq)',
        name: 'lmChatGroqLangfuse',
        icon: { light: 'file:../../credentials/groq-langfuse.svg', dark: 'file:../../credentials/groq-langfuse.svg' },
        group: ['transform'],
        version: 1,
        description: 'Groq Chat Model with Langfuse Tracing',
        defaults: {
            name: 'Langfuse Chat Model (Groq)',
        },
        codex: {
            categories: ['AI'],
            subcategories: {
                AI: ['Language Models', 'Root Nodes'],
            },
            resources: {
                primaryDocumentation: [
                    {
                        url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatgroq/?utm_source=n8n_app&utm_medium=node_settings_modal-credential_link&utm_campaign=%40n8n%2Fn8n-nodes-langchain.lmChatGroq',
                    },
                ],
            },
        },
        inputs: [],
        outputs: ['ai_languageModel' as any],
        outputNames: ['Model'],
        credentials: [
            {
                name: 'groqLangfuse',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Model',
                name: 'model',
                type: 'options',
                description: 'The model to use',
                typeOptions: {
                    loadOptionsMethod: 'listModels',
                },
                default: 'llama-3.1-8b-instant',
            },
            {
                displayName: 'Groq options',
                name: 'groqOptions',
                type: 'collection',
                placeholder: 'Add options',
                default: {},
                options: [
                    {
                        displayName: 'Temperature',
                        name: 'temperature',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 2,
                        },
                        default: 0.7,
                        description: 'Sampling temperature to use',
                    },
                    {
                        displayName: 'Max Completion Tokens',
                        name: 'max_completion_tokens',
                        type: 'number',
                        typeOptions: {
                            minValue: 1,
                        },
                        default: null,
                        description: 'The maximum number of tokens that can be generated in the chat completion',
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
            }
        ],
    };

    async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
        const credentials = await this.getCredentials('groqLangfuse');

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
            customMetadata?: string | Record<string, any>;
        };

        let customMetadata: Record<string, any> = {};

        if (typeof customMetadataRaw === 'string') {
            try {
                customMetadata = customMetadataRaw.trim()
                    ? jsonParse<Record<string, any>>(customMetadataRaw)
                    : {};
            } catch {
                customMetadata = { _raw: customMetadataRaw }; // fallback
            }
        } else if (customMetadataRaw && typeof customMetadataRaw === 'object') {
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
        const modelName = this.getNodeParameter('model', itemIndex) as string;

        const groqOptions = this.getNodeParameter('groqOptions', itemIndex, {}) as {
            temperature?: number;
            max_completion_tokens?: number;
        };

        const apiKey = credentials.apiKey as string;
        const model = new ChatGroq({
            apiKey,
            model: modelName,
            temperature: groqOptions.temperature,
            maxRetries: 2,
            maxTokens: groqOptions.max_completion_tokens,
            metadata: customMetadata,
            // baseURL is handled automatically by ChatGroq
            callbacks: [lfHandler, n8nHandler],
        });

        return {
            response: model,
        };
    }
}
