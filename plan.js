/* Stretch/Contraction v4.4 — programme data.
   Kept separate from the app so the native version can reuse it unchanged.
   Slot fields: id, name, tier (1 main, 2 accessory, 3 filler), g (superset letter or null),
   w (planned kg per set; null = no plan weight yet), lo/hi (rep range), rest (s after this exercise),
   ext (top-set extension: TF, P, RP, F, S2), kit (all tags required; "a|b" = either), swaps [{n, k, note?}],
   bw (bodyweight, no load), added (load is added to bodyweight). */
window.SC_PLAN = (function () {
  "use strict";
  const LAT_SWAPS = [{ n: "Lean-away DB lateral raise", k: ["dumbbells"] }, { n: "Band lateral raise", k: ["bands"] }];
  return {
    version: "4.4",
    DEFAULT_START: "2026-11-09",
    KIT: [
      ["barbell", "Barbell & plates"], ["rack", "Squat rack"], ["bench", "Adjustable bench"], ["dumbbells", "Dumbbells"],
      ["ezbar", "EZ bar"], ["plates", "Weight plates"], ["pullup", "Pull-up bar"], ["cable", "Cable / pulley"],
      ["bands", "Resistance bands"], ["machines", "Gym machines"]
    ],
    DEFAULT_HOME: ["dumbbells", "bench"],
    EXT: {
      TF: { top: "Top set to technical failure, no partials", label: null },
      P: { top: "Top set to failure + lengthened partials", label: "+P" },
      RP: { top: "Top set to failure + rest-pause 10–15 s", label: "+RP" },
      F: { top: "All sets to failure", label: null, flat: true },
      S2: { top: "Stop ~2 reps short", label: null, flat: true }
    },
    TIER: { 1: "Main", 2: "Accessory", 3: "Filler" },
    TIER_H: { 1: "Main lifts", 2: "Accessories", 3: "Fillers & core" },
    PLAN: [
      { id: "push", name: "Upper Push", short: "Push", day: "Mon", slots: [
        { id: "bench", name: "Barbell bench press", tier: 1, g: null, w: [120, 107.5, 107.5], lo: 5, hi: 8, rest: 150, ext: "TF", kit: ["barbell", "rack", "bench"],
          note: "Medium grip, elbows ~45–60°, touch the chest. Free-weight press is stretch-focused: tension peaks at the chest.",
          swaps: [{ n: "DB bench press", k: ["dumbbells", "bench"] }, { n: "Deficit push-up", k: [] }] },
        { id: "pecdeck", name: "Pec deck", tier: 2, g: "A", w: [null, null], lo: 10, hi: 15, rest: 0, ext: "RP", kit: ["machines"],
          note: "1-s squeeze at the midline; full ROM, controlled into the stretch.",
          swaps: [{ n: "Cable fly", k: ["cable"] }, { n: "Flat DB fly", k: ["dumbbells", "bench"] }, { n: "Band fly", k: ["bands"] }] },
        { id: "preacher", name: "Machine preacher curl", tier: 2, g: "A", w: [40, 35, 35], lo: 8, hi: 12, rest: 75, ext: "P", kit: ["machines"],
          note: "Partials in the bottom half. Biceps sit on Push day so they are fresh.",
          swaps: [{ n: "Incline DB curl", k: ["dumbbells", "bench"] }, { n: "Band curl", k: ["bands"] }] },
        { id: "latc1", name: "Cable lateral raise", tier: 2, g: "B", w: [28, 25, 25], lo: 10, hi: 15, rest: 0, ext: "P", kit: ["cable"],
          note: "Low pulley, cable across the front of the body.", swaps: LAT_SWAPS },
        { id: "revcurl", name: "Cable reverse curl", tier: 2, g: "B", w: [null, null], lo: 10, hi: 15, rest: 75, ext: "RP", kit: ["cable"],
          note: "Brachialis, brachioradialis and wrist extensors.",
          swaps: [{ n: "EZ-bar reverse curl", k: ["ezbar"] }, { n: "DB reverse curl", k: ["dumbbells"] }] },
        { id: "latm", name: "Machine lateral raise", tier: 2, g: "C", w: [null, null], lo: 12, hi: 15, rest: 0, ext: "RP", kit: ["machines"],
          note: "", swaps: [{ n: "DB lateral raise", k: ["dumbbells"] }, { n: "Band lateral raise", k: ["bands"] }] },
        { id: "hammer", name: "Cross-body DB hammer curl", tier: 2, g: "C", w: [18, 16, 16], lo: 8, hi: 12, rest: 75, ext: "RP", kit: ["dumbbells"],
          note: "Brachioradialis.", swaps: [{ n: "Band hammer curl", k: ["bands"] }] }
      ] },
      { id: "legsq", name: "Lower Push", short: "Legs Q", day: "Tue", slots: [
        { id: "hack", name: "Hack squat", tier: 1, g: "A", w: [72.5, 65, 65], lo: 6, hi: 10, rest: 60, ext: "P", kit: ["machines"],
          note: "Full depth every rep (Kubo 2019); partials in the bottom half. The wrist-curl fillers go in rests 1 and 2.",
          swaps: [{ n: "Heels-elevated barbell squat", k: ["barbell", "rack"] }, { n: "Heels-elevated DB goblet squat", k: ["dumbbells"] }] },
        { id: "wcurl", name: "Seated barbell wrist curl", tier: 3, g: "A", w: [27.5, 25], lo: 12, hi: 20, rest: 0, ext: "P", kit: ["barbell|ezbar"],
          note: "In hack rests 1–2, back-to-back with the wrist extension, then ~90 s before the next hack set.",
          swaps: [{ n: "Seated DB wrist curl", k: ["dumbbells"] }] },
        { id: "wext", name: "Seated barbell wrist extension", tier: 3, g: "A", w: [null, null], lo: 12, hi: 20, rest: 90, ext: "RP", kit: ["barbell|ezbar"],
          note: "Full wrist extension at the top.", swaps: [{ n: "DB reverse wrist curl", k: ["dumbbells"] }] },
        { id: "legext", name: "Leg extension", tier: 2, g: "B", w: [79, 70, 70], lo: 10, hi: 15, rest: 0, ext: "RP", kit: ["machines"],
          note: "1-s pause at the top for VMO. Antagonist superset with the leg curl.",
          swaps: [{ n: "Reverse Nordic", k: [] }, { n: "Band leg extension", k: ["bands"] }] },
        { id: "legcurl", name: "Seated leg curl", tier: 2, g: "B", w: [60, 52.5, 52.5], lo: 10, hi: 15, rest: 75, ext: "RP", kit: ["machines"],
          note: "Seated beats lying for growth (Maeo 2021). Hams twice a week: curl here, RDL on Lower Pull.",
          swaps: [{ n: "Nordic curl", k: [] }, { n: "Slider leg curl", k: [] }] },
        { id: "adduct", name: "Adductor machine", tier: 2, g: "C", w: [null, null, null], lo: 10, hi: 15, rest: 0, ext: "P", kit: ["machines"],
          note: "Start as wide as the machine allows; partials in the open half.",
          swaps: [{ n: "Cable hip adduction", k: ["cable"] }, { n: "Copenhagen plank", k: ["bench"] }] },
        { id: "calfst", name: "Standing calf raise", tier: 2, g: "C", w: [95, 85, 85], lo: 8, hi: 12, rest: 75, ext: "P", kit: ["machines"],
          note: "2-s pause at the bottom; partials in the bottom half (Kassiano 2023).",
          swaps: [{ n: "Single-leg DB calf raise", k: ["dumbbells"], note: "On a step, with a full stretch at the bottom." }] },
        { id: "hlr", name: "Hanging leg raise", tier: 3, g: null, w: [null, null], bw: true, lo: 10, hi: 15, rest: 60, ext: "F", kit: ["pullup"],
          note: "Curl the pelvis up at the top.", swaps: [{ n: "Lying reverse crunch", k: [] }] }
      ] },
      { id: "pull", name: "Upper Pull", short: "Pull", day: "Wed", slots: [
        { id: "pullup", name: "Weighted wide-grip pull-up", tier: 1, g: null, w: [10, 0, 0], added: true, lo: 6, hi: 10, rest: 150, ext: "P", kit: ["pullup"],
          note: "Full dead hang every rep. Partials are half reps from the hang. Weight is the load added to bodyweight.",
          swaps: [{ n: "Wide-grip lat pulldown", k: ["cable"] }] },
        { id: "tbar", name: "Wide chest-supported T-bar row", tier: 1, g: null, w: [null, null, null], lo: 8, hi: 12, rest: 150, ext: "RP", kit: ["machines"],
          note: "Elbows ~45–60° out, 1-s hold at the top.",
          swaps: [{ n: "Wide chest-supported DB row", k: ["dumbbells", "bench"] }, { n: "Barbell seal row", k: ["barbell", "bench"] }] },
        { id: "rdfly", name: "Cable rear delt fly (cross-body)", tier: 2, g: "A", w: [null, null, null], lo: 12, hi: 20, rest: 0, ext: "P", kit: ["cable"],
          note: "Cables crossed; start with the arm across the body.",
          swaps: [{ n: "Incline DB rear delt fly", k: ["dumbbells", "bench"] }, { n: "Band pull-apart", k: ["bands"] }] },
        { id: "ohext", name: "Overhead cable triceps extension", tier: 2, g: "A", w: [40, 35, 35], lo: 10, hi: 15, rest: 75, ext: "P", kit: ["cable"],
          note: "Overhead beats neutral for growth (Maeo 2023).",
          swaps: [{ n: "Overhead DB triceps extension", k: ["dumbbells"] }, { n: "Band overhead extension", k: ["bands"] }] },
        { id: "rdmach", name: "Rear delt machine", tier: 2, g: "B", w: [35, 30], lo: 12, hi: 20, rest: 0, ext: "RP", kit: ["machines"],
          note: "", swaps: [{ n: "Incline DB rear delt fly", k: ["dumbbells", "bench"] }, { n: "Band face pull", k: ["bands"] }] },
        { id: "pushdown", name: "Triceps pushdown", tier: 2, g: "B", w: [null, null], lo: 10, hi: 15, rest: 75, ext: "RP", kit: ["cable"],
          note: "Hard lockout.", swaps: [{ n: "Band pushdown", k: ["bands"] }, { n: "Close-grip push-up", k: [] }] }
      ] },
      { id: "legpost", name: "Lower Pull", short: "Legs P", day: "Thu", slots: [
        { id: "rdl", name: "Romanian deadlift", tier: 1, g: null, w: [120, 107.5, 107.5], lo: 6, hi: 10, rest: 150, ext: "TF", kit: ["barbell"],
          note: "RDL machine if available. Straps are fine.", swaps: [{ n: "DB Romanian deadlift", k: ["dumbbells"] }] },
        { id: "bss", name: "Bulgarian split squat (glute bias)", tier: 1, g: "A", w: [20, 18, 18], lo: 8, hi: 12, rest: 60, ext: "TF", kit: ["dumbbells", "bench"],
          note: "Longer stride, torso ~30° forward, deep. The neck fillers go in rests 1 and 2.",
          swaps: [{ n: "Bodyweight Bulgarian split squat", k: ["bench"] }] },
        { id: "neckf", name: "Neck flexion", tier: 3, g: "A", w: [null, null], lo: 15, hi: 25, rest: 0, ext: "S2", kit: ["plates|dumbbells"],
          note: "Plate on the forehead lying supine, or a 4-way machine. 2-s lowering, pain-free range, start very light. The failure rule does not apply to the neck.",
          swaps: [{ n: "Manual-resistance neck flexion", k: [] }] },
        { id: "necke", name: "Neck extension", tier: 3, g: "A", w: [null, null], lo: 15, hi: 25, rest: 90, ext: "S2", kit: ["plates|dumbbells"],
          note: "Harness or 4-way machine. Chin tucked, move only at the neck (Conley 1997).",
          swaps: [{ n: "Band neck extension", k: ["bands"] }, { n: "Manual-resistance neck extension", k: [] }] },
        { id: "abduct", name: "Abductor machine (lean forward)", tier: 2, g: "B", w: [null, null], lo: 12, hi: 20, rest: 0, ext: "RP", kit: ["machines"],
          note: "Lean ~30° forward to bias upper glute max.",
          swaps: [{ n: "Banded seated hip abduction", k: ["bands"] }, { n: "Side-lying hip abduction", k: [] }] },
        { id: "calfse", name: "Seated calf raise", tier: 2, g: "B", w: [30, 25, 25], lo: 10, hi: 15, rest: 75, ext: "P", kit: ["machines"],
          note: "2-s pause at the bottom.", swaps: [{ n: "Seated DB calf raise", k: ["dumbbells"] }] },
        { id: "decline", name: "Weighted decline crunch", tier: 3, g: null, w: [12.5, 10], lo: 12, hi: 20, rest: 60, ext: "F", kit: ["bench", "plates|dumbbells"],
          note: "Full extension at the bottom of each rep.",
          swaps: [{ n: "Weighted floor crunch", k: ["plates|dumbbells"] }, { n: "Floor crunch", k: [] }] }
      ] },
      { id: "upper", name: "Upper (second hit)", short: "Upper", day: "Fri", slots: [
        { id: "shpress", name: "Machine shoulder press", tier: 1, g: null, w: [null, null, null], lo: 6, hi: 10, rest: 150, ext: "P", kit: ["machines"],
          note: "Partials in the bottom half, starting week 2.",
          swaps: [{ n: "Seated DB shoulder press", k: ["dumbbells", "bench"], note: "With dumbbells: technical failure, no partials." }] },
        { id: "pullover", name: "DB pullover", tier: 2, g: "A", w: [22, 20, 20], lo: 10, hi: 15, rest: 0, ext: "TF", kit: ["dumbbells", "bench"],
          note: "Ribs down, lower until the lats stretch. Antagonist superset with the low-to-high fly.", swaps: [] },
        { id: "lthfly", name: "Low-to-high cable fly", tier: 2, g: "A", w: [15, 12.5, 12.5], lo: 12, hi: 15, rest: 75, ext: "RP", kit: ["cable"],
          note: "Upper-chest second hit.",
          swaps: [{ n: "Low-incline DB fly", k: ["dumbbells", "bench"] }, { n: "Band low-to-high fly", k: ["bands"] }] },
        { id: "csrow", name: "Chest-supported incline DB row", tier: 1, g: null, w: [45, 40], lo: 8, hi: 12, rest: 150, ext: "RP", kit: ["dumbbells", "bench"],
          note: "Close/neutral grip, elbows tucked, pull to the lower chest: mid-back and lat bias against Wednesday's wide row.",
          swaps: [{ n: "Machine chest-supported row", k: ["machines"] }] },
        { id: "latc2", name: "Cable lateral raise", tier: 2, g: "B", w: [28, 25, 25], lo: 10, hi: 15, rest: 0, ext: "P", kit: ["cable"],
          note: "Side delts second hit. Low pulley, cable across the front of the body.", swaps: LAT_SWAPS },
        { id: "skull", name: "EZ-bar skull crusher", tier: 2, g: "B", w: [40, 35], lo: 8, hi: 12, rest: 75, ext: "TF", kit: ["ezbar|barbell", "bench"],
          note: "Lower behind the head for the long-head stretch.", swaps: [{ n: "DB skull crusher", k: ["dumbbells", "bench"] }] }
      ] }
    ]
  };
})();
