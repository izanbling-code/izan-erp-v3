import { z } from "zod";

const zFrame = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(100),
  height: z.number().default(100),
  rotation: z.number().default(0),
  zIndex: z.number().default(1),
});

const zElement = z.object({
  id: z.string(), type: z.string(), name: z.string(),
  hidden: z.boolean().optional(), locked: z.boolean().optional(),
  frame: zFrame,
  tablet: z.object({ x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional() }).optional(),
  mobile: z.object({ x: z.number().optional(), y: z.number().optional(), width: z.number().optional(), height: z.number().optional() }).optional(),
  style: z.record(z.string(), z.unknown()),
  content: z.record(z.string(), z.unknown()),
});

const zSection = z.looseObject({
  id: z.string(), type: z.string(), name: z.string(),
  disabled: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()),
  blocks: z.array(z.object({ id: z.string(), type: z.string(), settings: z.record(z.string(), z.unknown()) })),
  elements: z.array(zElement).optional(),
});

export const zStorefront = z.looseObject({
  theme: z.looseObject({
    colors: z.record(z.string(), z.string()),
    typography: z.record(z.string(), z.unknown()),
  }),
  templates: z.record(z.string(), z.object({ sections: z.array(zSection) })),
});