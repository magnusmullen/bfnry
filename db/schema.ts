import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  balance: integer("balance").notNull().default(100),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const gameResults = sqliteTable("game_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerEmail: text("player_email").notNull(),
  choice: text("choice").notNull(),
  roll: integer("roll").notNull(),
  delta: integer("delta").notNull(),
  createdAt: text("created_at").notNull(),
});
