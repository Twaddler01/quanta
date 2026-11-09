import { Save } from "./config.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";

Save.read();
UI.build();
Game.boot();
