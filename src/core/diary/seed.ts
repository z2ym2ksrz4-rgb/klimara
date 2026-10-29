import type { Migration } from "@/core/db/migrations";
import type { DiaryConfig } from "./types";

/**
 * Builds the domain's seed migration from its config. Ids are deterministic (`tg_<group>`, `tag_<group>_<key>`)
 * so two devices seed identical rows and backup merge never duplicates a tag.
 * INSERT OR IGNORE keeps user edits (hidden/sort) on re-run.
 */
export function seedMigration(version: number, config: DiaryConfig): Migration {
  const now = "1970-01-01T00:00:00.000Z"; // older than any user edit → user's row wins on merge
  const esc = (s: string) => s.replace(/'/g, "''");
  const sql: string[] = [];
  config.tagGroups.forEach((g, gi) => {
    sql.push(
      `INSERT OR IGNORE INTO tagGroup(id,key,kind,sort,isSystem,updatedAt) VALUES('tg_${esc(g.key)}','${esc(g.key)}','${esc(g.kind)}',${gi},1,'${now}');`,
    );
    g.tags.forEach((tk, ti) => {
      sql.push(
        `INSERT OR IGNORE INTO tag(id,groupId,key,labelKey,label,isSystem,isHidden,sort,updatedAt) VALUES('tag_${esc(g.key)}_${esc(tk)}','tg_${esc(g.key)}','${esc(tk)}','diary.tags.${esc(g.key)}.${esc(tk)}',NULL,1,0,${ti},'${now}');`,
      );
    });
  });
  return { version, name: `${config.slug}_seed_tags`, sql };
}
