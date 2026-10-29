import type { TagGroupDef } from "@/core/diary";

/**
 * Tag sets for a hot flush. Keys are stable identifiers (seed ids are derived from them – never rename, only add);
 * labels live in locales under diary.tags.<group>.<key>.
 */
export const klimaraTagGroups: TagGroupDef[] = [
  {
    key: "trigger",
    kind: "trigger",
    tags: ["alcohol", "coffee", "hot_drink", "spicy_food", "sugar", "large_meal", "warm_room", "sun", "bedding", "clothing", "exercise", "stress", "smoking"],
  },
  {
    key: "location",
    kind: "location",
    tags: ["home", "in_bed", "work", "outside", "transport", "shop", "social"],
  },
  {
    key: "relief",
    kind: "relief",
    tags: ["fan", "cold_water", "layers_off", "open_window", "cool_shower", "breathing", "sit_down", "nothing"],
  },
];
