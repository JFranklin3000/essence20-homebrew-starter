# Essence20 Homebrew Starter

A starting point for your own Essence20 content in Foundry VTT v14.

- **Compendiums already set up**, in a "Homebrew" folder: Perks, Powers and Spells, Roles and Origins, Gear and
  Weapons, Zord and Transformer Features, Threats and NPCs.
- **Worked examples** of the fields that matter: a Perk with a rule and a prerequisite, a Power, a piece of gear.
- **A guide, in Foundry** (the *Homebrew Guide* compendium): making it yours, what goes where, how the Compendium
  Browser finds your items, the Rules tab, prerequisites, what not to include, and sharing.

## Make it yours

This is a template - give your copy its own identity before you fill it, or it will clash with anyone else's:

1. Copy this folder in `Data/modules` and rename the copy, e.g. `my-ranger-homebrew` (lower case, numbers, hyphens).
2. In the copy's `module.json`, set `id` to exactly the new folder name, and change `title`, `description` and
   `authors`. Delete `url`, `manifest`, `download` and `bugs` (or point them at your own repository) - otherwise
   Foundry would "update" your copy back to this kit.
3. Optionally rename the compendium labels (`packs[].label`) and the folder (`packFolders[].name`). To list your books
   with a game line in the Compendium Browser, name the folder exactly like that line's: `GI Joe`, `My Little Pony`,
   `Power Rangers`, `Transformers` or `Welcome to Night Vale`.
4. Turn your module on in a world. Module compendiums are locked: right-click one and choose **Toggle Edit Lock** to
   edit. Your changes are saved into your module's folder.
5. Delete the example items, and any compendiums you don't need (from `module.json` and `packs/`).

## Showing up in the Compendium Browser

Every loaded Item compendium is in the browser - nothing to register. The book groups come from the compendium's
folder, the book name from its label, the page from the item's Source page, the tabs from item types, the filters from
a Perk's or Power's type, traits, Gear Type and a Power's Availability, and "Qualifies for" from its prerequisites. Search is by
name. The guide in Foundry has the full table.

## Your words, not the book's

Describe your items in your own words; put the book and page in the item's Source if it's based on one. Don't include
rulebook text, or official art, logos or stat blocks from the Hasbro lines - fine in a private game, not in something
you share.

## For people who keep their content in git

`packs/_source/` holds each compendium's contents as JSON (one file per document). Foundry only reads the compiled
`packs/<name>` folders, which git ignores. With the world closed, `npm install` once, then `npm run build` compiles
the JSON into them; `npm test` checks the manifest and the JSON. To go the other way - edit in Foundry, then save as
JSON - use the Foundry CLI's `package unpack`.

The release workflow (`.github/workflows/release.yml`) builds and attaches `module.json` and `module.zip` whenever
you publish a GitHub release; a pre-release goes out on a separate beta channel.

## License

[MIT No Attribution](LICENSE): use it, copy it and change it freely, no credit needed - it's a template. The examples
and guide were written for this kit.
