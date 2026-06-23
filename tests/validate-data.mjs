import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async name => JSON.parse(await readFile(path.join(root, "data", name), "utf8"));
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

const [cocktails, ingredients, techniques, glassware, rules, questions, scenarios] = await Promise.all([
  readJson("cocktails.json"),
  readJson("ingredients.json"),
  readJson("techniques.json"),
  readJson("glassware.json"),
  readJson("utah-rules.json"),
  readJson("questions.json"),
  readJson("scenarios.json")
]);

assert(Array.isArray(cocktails) && cocktails.length >= 50, "At least 50 cocktails are required.");
assert(Array.isArray(questions) && questions.length >= 100, "At least 100 quiz questions are required.");
assert(Array.isArray(scenarios) && scenarios.length >= 20, "At least 20 practice scenarios are required.");
assert(Array.isArray(ingredients) && ingredients.length > 0, "Ingredient data is required.");
assert(Array.isArray(techniques) && techniques.length >= 16, "Technique data is incomplete.");
assert(Array.isArray(glassware.glassware) && glassware.glassware.length >= 15, "Glassware data is incomplete.");
assert(Array.isArray(glassware.ice) && glassware.ice.length >= 7, "Ice data is incomplete.");

const requiredCocktailFields = [
  "id", "name", "alternateNames", "cocktailFamily", "baseSpirit", "secondaryAlcoholicIngredients",
  "nonalcoholicIngredients", "standardSpecification", "utahSpecification", "totalPrimarySpiritVolume",
  "totalSecondaryAlcoholicFlavoringVolume", "totalSpirituousLiquorVolume", "preparationMethod", "buildOrder",
  "glassware", "iceType", "garnish", "toolsRequired", "difficulty", "flavorProfile", "approximateStrength",
  "appearance", "commonCustomerDescription", "historyOrOrigin", "whyRecipeWorks", "commonMistakes",
  "acceptableSubstitutions", "doNotSubstitute", "speedServiceVersion", "memoryTrick", "relatedCocktails",
  "utahComplianceStatus", "legalExplanation", "sourceVerificationNotes", "lastReviewedDate"
];

const ids = new Set();
for (const [index, cocktail] of cocktails.entries()) {
  for (const field of requiredCocktailFields) {
    assert(cocktail[field] !== undefined && cocktail[field] !== null, `Cocktail ${index} (${cocktail.name || "unnamed"}) is missing ${field}.`);
  }
  assert(!ids.has(cocktail.id), `Duplicate cocktail id: ${cocktail.id}`);
  ids.add(cocktail.id);
  for (const specName of ["standardSpecification", "utahSpecification"]) {
    const spec = cocktail[specName];
    assert(spec && Array.isArray(spec.ingredients) && spec.ingredients.length > 0, `${cocktail.id} has no ${specName} ingredients.`);
    for (const ingredient of spec.ingredients) {
      assert(typeof ingredient.name === "string" && ingredient.name.trim(), `${cocktail.id} has an unnamed ingredient.`);
      assert(Number.isFinite(Number(ingredient.amount)), `${cocktail.id} has a nonnumeric ingredient amount.`);
      assert(typeof ingredient.classification === "string" && ingredient.classification, `${cocktail.id} has an unclassified ingredient.`);
    }
  }
}

const questionIds = new Set();
for (const q of questions) {
  assert(q.id && !questionIds.has(q.id), `Duplicate or missing question id: ${q.id}`);
  questionIds.add(q.id);
  assert(q.prompt && Array.isArray(q.options) && q.options.length >= 2, `Invalid question: ${q.id}`);
  assert(q.options.includes(q.answer), `Question answer is not in options: ${q.id}`);
}

const scenarioIds = new Set();
for (const scenario of scenarios) {
  assert(scenario.id && !scenarioIds.has(scenario.id), `Duplicate or missing scenario id: ${scenario.id}`);
  scenarioIds.add(scenario.id);
  assert(scenario.guestRequest && Array.isArray(scenario.options) && scenario.options.length >= 2, `Invalid scenario: ${scenario.id}`);
  assert(scenario.options.includes(scenario.correctDrinkId), `Scenario answer is not in options: ${scenario.id}`);
}

for (const key of ["primarySpiritMaxOz", "totalSpirituousLiquorMaxOz", "wineIndividualPortionMaxOz"]) {
  assert(Number.isFinite(Number(rules.limits?.[key])), `Missing numeric Utah rule limit: ${key}`);
}
assert(rules.lastLegallyReviewed, "Missing legal review date.");
assert(Array.isArray(rules.rules) && rules.rules.every(rule => /^https:\/\/(le\.utah\.gov|abs\.utah\.gov)\//.test(rule.officialSource)), "Every legal rule must link to an official Utah source.");
assert(Array.isArray(rules.lessons) && rules.lessons.every(lesson => /^https:\/\/(le\.utah\.gov|abs\.utah\.gov)\//.test(lesson.source)), "Every legal lesson must link to an official Utah source.");

console.log(`Validated ${cocktails.length} cocktails, ${questions.length} questions, ${scenarios.length} scenarios, ${ingredients.length} ingredients, ${techniques.length} techniques, ${glassware.glassware.length} glass types, and ${glassware.ice.length} ice types.`);
