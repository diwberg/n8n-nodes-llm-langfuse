import { DynamicStructuredTool } from "@langchain/core/tools";
import type { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import type { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class N8nTool extends DynamicStructuredTool<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async _call(input: string, runManager?: CallbackManagerForToolRun): Promise<any> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parser = (this as any).schema as z.ZodSchema<any>;
            const parsed = await parser.parseAsync(input);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (this as any).func(parsed, runManager);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Tool input parse failed: ${message}`);
        }
    }
}
