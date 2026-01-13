import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { BaseMessage } from "@langchain/core/messages";
import type { LLMResult } from "@langchain/core/outputs";
import {
    type ISupplyDataFunctions,
    type IExecuteFunctions,
    type IDataObject,
    NodeOperationError,
    type JsonObject,
} from "n8n-workflow";
import { logAiEvent } from "./helpers";

interface IExtendedExecuteFunctions extends IExecuteFunctions {
    getNextRunIndex(): number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addInputData(connectionType: string, data: any[], sourceNodeRunIndex?: number): { index: number };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addOutputData(connectionType: string, runIndex: number, data: any[] | Error, unused?: undefined, sourceNodeRunIndex?: number): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getNode(): any;
}

type RunDetail = {
    index: number;
    messages: BaseMessage[] | string[] | string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any;
};

export class N8nLlmTracing extends BaseCallbackHandler {
    name = "N8nLlmTracing";
    awaitHandlers = true;

    connectionType = 'ai_languageModel';
    #parentRunIndex?: number;
    runsMap: Record<string, RunDetail> = {};

    constructor(private executionFunctions: ISupplyDataFunctions | IExecuteFunctions) {
        super();
    }

    async handleLLMStart(llm: Serialized, prompts: string[], runId: string) {
        try {
            const sourceNodeRunIndex =
                this.#parentRunIndex !== undefined
                    ? this.#parentRunIndex + (this.executionFunctions as unknown as IExtendedExecuteFunctions).getNextRunIndex?.()
                    : undefined;

            const options = (llm && llm.type === "constructor") ? llm.kwargs : llm;

            const { index } = (this.executionFunctions as unknown as IExtendedExecuteFunctions).addInputData(
                this.connectionType,
                [[{ json: { messages: prompts, options } }]],
                sourceNodeRunIndex,
            );

            this.runsMap[runId] = {
                index,
                options,
                messages: prompts,
            };
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[N8nLlmTracing] handleLLMStart failed silently:', error);
        }
    }

    async handleLLMEnd(output: LLMResult, runId: string) {
        try {
            const runDetails = this.runsMap[runId] ?? { index: 0, options: {}, messages: [] };

            const response = { response: { generations: output.generations } };

            const sourceNodeRunIndex =
                this.#parentRunIndex !== undefined ? this.#parentRunIndex + runDetails.index : undefined;

            (this.executionFunctions as unknown as IExtendedExecuteFunctions).addOutputData(
                this.connectionType,
                runDetails.index,
                [[{ json: response }]],
                undefined,
                sourceNodeRunIndex,
            );

            logAiEvent(this.executionFunctions, "ai-llm-generated-output", {
                messages: runDetails.messages,
                options: runDetails.options,
                response,
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[N8nLlmTracing] handleLLMEnd failed silently:', error);
        }
    }

    async handleLLMError(error: IDataObject | Error, runId: string, parentRunId?: string) {
        const runDetails = this.runsMap[runId] ?? { index: 0, options: {}, messages: [] };

        (this.executionFunctions as unknown as IExtendedExecuteFunctions).addOutputData(
            this.connectionType,
            runDetails.index,
            new NodeOperationError((this.executionFunctions as unknown as IExtendedExecuteFunctions).getNode(), error as JsonObject, {
                functionality: "configuration-node",
            }),
            undefined,
        );

        logAiEvent(this.executionFunctions, "ai-llm-errored", {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            error: (error as any)?.message ?? String(error),
            runId,
            parentRunId,
        });
    }

    setParentRunIndex(runIndex: number) {
        this.#parentRunIndex = runIndex;
    }
}
