import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classify } from "./classify.ts";

const range = { min: 30, max: 45 };

Deno.test("innerhalb der Spannbreite → im regionalen Rahmen", () => {
  assertEquals(classify({ vergleichspreis: 40, ...range }).stufe, "im_regionalen_rahmen");
});

Deno.test("bis 10 % über Obergrenze → im regionalen Rahmen", () => {
  assertEquals(classify({ vergleichspreis: 49.5, ...range }).stufe, "im_regionalen_rahmen");
});

Deno.test("20 % über Obergrenze → leicht über Vergleich", () => {
  const r = classify({ vergleichspreis: 54, ...range });
  assertEquals(r.stufe, "leicht_ueber_vergleich");
  assertEquals(r.abweichung_prozent, 20);
});

Deno.test("61 % über Obergrenze → auffällig hoch (nie im Rahmen)", () => {
  assertEquals(classify({ vergleichspreis: 72.45, ...range }).stufe, "auffaellig_hoch");
});

Deno.test("mehr als 25 % unter Untergrenze → auffällig niedrig", () => {
  assertEquals(classify({ vergleichspreis: 20, ...range }).stufe, "auffaellig_niedrig");
});

Deno.test("20 % unter Untergrenze → im regionalen Rahmen", () => {
  assertEquals(classify({ vergleichspreis: 24, ...range }).stufe, "im_regionalen_rahmen");
});

Deno.test("ohne Preis → nicht einordenbar", () => {
  assertEquals(classify({ vergleichspreis: null, ...range }).stufe, "nicht_einordenbar");
});
