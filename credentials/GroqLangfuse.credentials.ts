import type {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class GroqLangfuse implements ICredentialType {
    name = 'groqLangfuse';
    displayName = 'Langfuse Groq API';
    documentationUrl = 'https://langfuse.com/docs/integrations/n8n';
    icon = { light: 'file:groq-langfuse.svg', dark: 'file:groq-langfuse.svg' } as const;

    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
        },
        {
            displayName: 'Langfuse Base URL',
            name: 'langfuseBaseUrl',
            type: 'string',
            default: 'https://cloud.langfuse.com',
        },
        {
            displayName: 'Langfuse Public Key',
            name: 'langfusePublicKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
        },
        {
            displayName: 'Langfuse Secret Key',
            name: 'langfuseSecretKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
        },
        {
            displayName: '⚠️ Validation limits',
            name: 'notice',
            type: 'notice',
            default: 'The "Test Connection" button ONLY validates the Groq API Key. Langfuse credentials are not validated here; please check the logs or Langfuse dashboard after running a workflow.',
        },
    ];

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '=Bearer {{$credentials.apiKey}}',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            baseURL: 'https://api.groq.com/openai/v1',
            url: '/models',
        },
    };
}
