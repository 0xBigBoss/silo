import { SiloError } from "../utils/errors";

export type TemplateVars = Record<string, string | number>;

export const interpolateTemplate = (template: string, vars: TemplateVars): string =>
  template.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, key: string) => {
    if (!(key in vars)) {
      throw new SiloError(`Unknown variable in template: ${key}`, "INVALID_TEMPLATE");
    }
    return String(vars[key]);
  });
