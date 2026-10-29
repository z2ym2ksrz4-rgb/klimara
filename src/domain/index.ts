/**
 * Domain registry. Klimara = the generic symptom-diary engine (src/core/diary) configured for menopause
 * (src/domain/klimara). A sibling app swaps only this folder.
 */
import { diaryMigrations, configureDiary } from "@/core/diary";
import { klimaraMigrations } from "./klimara/migrations";
import { klimaraConfig } from "./klimara/config";
import { KlimaraRoutes, domainTabs, type DomainTab } from "./klimara/routes";

configureDiary(klimaraConfig);

export const domainMigrations = [...diaryMigrations, ...klimaraMigrations];
export const DomainRoutes = KlimaraRoutes;
export { domainTabs };
export type { DomainTab };
