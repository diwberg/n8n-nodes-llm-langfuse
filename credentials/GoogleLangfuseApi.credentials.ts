import type {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class GoogleLangfuseApi implements ICredentialType {
    name = 'googleLangfuseApi';
    displayName = 'Langfuse Google Gemini API';
    documentationUrl = 'https://langfuse.com/docs/integrations/n8n';
    icon = { light: 'file:gemini-langfuse.svg', dark: 'file:gemini-langfuse.svg' } as const;
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
            default: 'The "Test Connection" button ONLY validates the Google API Key. Langfuse credentials are not validated here; please check the logs or Langfuse dashboard after running a workflow.',
        },
    ];

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            qs: {
                key: '={{$credentials.apiKey}}',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            baseURL: 'https://generativelanguage.googleapis.com/v1beta',
            url: '/models',
        },
    };
}
