import extractMenuImages from "./extractMenuImages.mjs";
import extractMenuImagesV2 from "./extractMenuImagesV2.mjs";
import extractMenuImagesV3 from "./extractMenuImagesV3.mjs";
import extractMenuImagesV4 from "./extractMenuImagesV4.mjs";
import extractMenuImagesV5 from "./extractMenuImagesV5.mjs";
import selfTest from "./selfTest.mjs";
import path from "node:path";

// Same recipe as extractMenuImages with another model, to compare cost and accuracy: the prompt, tools and limits are the very same object.
const extractMenuImagesSonnet = { ...extractMenuImages, name: "extractMenuImagesSonnet", model: "claude-sonnet-5-5" };

// Same again with Opus; its spend cap is raised to 1 USD (a ceiling of 1 USD per menu) because 0.6 could cut a run short. Prompt unchanged.
const extractMenuImagesOpus = { ...extractMenuImages, name: "extractMenuImagesOpus", model: "claude-opus-5-5", maxBudgetUsd: 1.0 };

/** Command name -> recipe. Adding a command is adding a module here. */
export const recipes = { extractMenuImages, extractMenuImagesV2, extractMenuImagesV3, extractMenuImagesV4, extractMenuImagesV5, extractMenuImagesSonnet, extractMenuImagesOpus, selfTest };

/**
 * Validates `params` against a recipe's declarative spec.
 * A string spec accepts `min`, `max`, `https` (must be an https URL) and `absolutePath` (must be an absolute POSIX path
 * with no NUL byte and no `..` segment; whether it exists is not checked here).
 * @param {object} recipe Recipe with a `params` spec.
 * @param {unknown} params Value received over HTTP.
 * @returns {string|null} an error message, or null when valid.
 */
export function validateParams(recipe, params) {
  if (params === undefined) params = {};
  if (params === null || typeof params !== "object" || Array.isArray(params)) return "params must be an object";
  for (const key of Object.keys(params)) if (!(key in recipe.params)) return `unknown param: ${key}`;
  for (const [key, spec] of Object.entries(recipe.params)) {
    const value = params[key];
    if (value === undefined) {
      if (spec.required) return `missing param: ${key}`;
      continue;
    }
    if (spec.type === "string") {
      if (typeof value !== "string") return `${key} must be a string`;
      if (spec.min !== undefined && value.length < spec.min) return `${key} is too short`;
      if (spec.max !== undefined && value.length > spec.max) return `${key} is too long`;
      if (spec.https) {
        let parsed;
        try {
          parsed = new URL(value);
        } catch {
          return `${key} must be a URL`;
        }
        if (parsed.protocol !== "https:") return `${key} must be an https URL`;
      }
      if (spec.absolutePath && (value.includes("\0") || !path.posix.isAbsolute(value) || value.split("/").includes(".."))) return `${key} must be an absolute path without ".." segments`;
    } else if (spec.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return `${key} must be a number`;
      if (spec.min !== undefined && value < spec.min) return `${key} is too small`;
      if (spec.max !== undefined && value > spec.max) return `${key} is too large`;
    } else if (spec.type === "integer") {
      if (!Number.isInteger(value)) return `${key} must be an integer`;
      if (spec.min !== undefined && value < spec.min) return `${key} is too small`;
      if (spec.max !== undefined && value > spec.max) return `${key} is too large`;
    }
  }
  return null;
}
