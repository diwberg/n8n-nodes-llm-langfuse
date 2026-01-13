import type { IDataObject, ISupplyDataFunctions, IExecuteFunctions } from "n8n-workflow";

export function logAiEvent(
    executeFunctions: ISupplyDataFunctions | IExecuteFunctions,
    event: "ai-llm-generated-output" | "ai-llm-errored",
    data?: IDataObject,
) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (executeFunctions as any).logAiEvent(event, data ? JSON.stringify(data) : undefined);
    } catch {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (executeFunctions as any).logger?.debug?.(`Error logging AI event: ${event}`);
    }
}


