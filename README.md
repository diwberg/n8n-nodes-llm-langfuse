# n8n-nodes-llm-langfuse

This is an n8n community node that provides custom LLM Chat Models with built-in **Langfuse** observability. It allows you to easily trace your LLM executions, monitor token usage, and debug complex chains directly from your n8n workflows.

## Features

-   **Built-in Langfuse Tracing**: Automatically sends traces to Langfuse for every generation.
-   **Multi-Provider Support**:
    -   **OpenAI**: Chat with GPT-4o, GPT-4-turbo, and other OpenAI models.
    -   **Groq**: Ultra-fast inference with Llama 3, Mixtral, and Gemma models.
    -   **Google Gemini**: Use Gemini 1.5 Pro, Flash, and other Google models.
-   **Advanced Configuration**:
    -   Control `Temperature`, `Top P`, `Frequency Penalty`, `Presence Penalty`, `Max Tokens`, and more.
    -   Pass custom **Langfuse Metadata**, **Session IDs**, and **User IDs** for better trace organization.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

1.  In your n8n instance, go to **Settings > Community Nodes**.
2.  Select **Install**.
3.  Enter `n8n-nodes-llm-langfuse`.

## Credentials

You will need to set up credentials for both the LLM provider and Langfuse.

### Langfuse Credentials
Required for all nodes in this package.
-   **Public Key**: Your Langfuse project public key.
-   **Secret Key**: Your Langfuse project secret key.
-   **Base URL**: The Langfuse API URL (e.g., `https://cloud.langfuse.com` or your self-hosted instance).

### Provider Credentials
-   **OpenAI**: Your OpenAI API Key.
-   **Groq**: Your Groq Cloud API Key.
-   **Google Gemini**: Your Google AI Studio API Key.

## Usage

These nodes act as **Chat Models** within n8n's AI ecosystem. You can use them in any LangChain chain or agent that accepts a Language Model.

1.  Add an **AI Agent** or **Chain** node to your workflow.
2.  Connect one of the **Langfuse Chat Model** nodes (OpenAI, Groq, or Gemini) to the `Model` input.
3.  Configure the node:
    -   Select your **Credential**.
    -   Choose the **Model** (e.g., `gpt-4o`, `llama-3.1-8b-instant`).
    -   Adjust parameters like **Temperature** and **Max Tokens**.
    -   (Optional) Add **Langfuse Metadata** to tag your traces (e.g., `{"environment": "production"}`).

## License

MIT
