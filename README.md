# bg3-osiris

This extension for Visual Studio Code provides language support for Osiris, the scripting language used by Baldur's Gate 3 and other Divinity Engine games.

## Quick Start

1. Install this extension from the Marketplace or as a VSIX file from [GitHub](https://github.com/SASUKE38/bg3-osiris).
2. Navigate to the BG3 Osiris extension settings in Visual Studio Code. Set the `bg3Osiris.dependencyPaths` setting to include all file paths that contain mod dependencies; these should contain `.pak` files, such as `.../Baldurs Gate 3/Data`.
3. Open a mod. The opened directory must be your mod's `Mods` directory, which should contain a `Story` directory and `meta.lsx` file in the top level.
4. If you would like to take advantage of the new Osiris syntax highlighting, set the `workbench.colorTheme` setting to either `osirisDark.theme`, `osirisLight.theme`, or your own custom theme. For more information, see the Syntax Highlighting section below.

Note that advanced features are supported only for folders, not single files.

## Features

BG3 Osiris includes support for a variety of features that are absent in the official tookit, such as:

- Rich syntax highlighting
- Live diagnostics
- Hover information
- Signature help
- Autocompletion
- Symbol renaming
- Go to references and definitions support

### Story Outline

The story outline is an integral part of Osiris functionality. This extension provides an implementation of it in Visual Studio Code which allows for creating, overriding, and moving goals. To open the Story Outline, navigate to the side bar and click on the newly added "Story Outline" button to open the Story Outline view. The following operations are supported:

- Add Goal
    - Goals can be added by clicking on the plus icon that appears while hovering over an item in the Story Outline view.
- Delete Goal
    - Overriden/local goals can be deleted by right-clicking to open the context menu on a view item and selecting 'Delete'. Overriden goals will be reverted to their inherited originals.
- Rename Goal
    - Overriden/local goals can be renamed by right-clicking to open the context menu on a view item and selecting 'Rename'.
- Move Goal
    - Goals can be moved by dragging and dropping them onto the desired parent item.

### Syntax Highlighting

This extension offers rich syntax highlighting for all components of an Osiris script. This includes functions, GUIDs, variables, keywords, and structure entities.

Custom TextMate scopes are used to differentiate between the various Osiris function types. Dark and light themes that take advantage of these new scopes are bundled with this extension. To create your own color themes using these scopes, provide color definitions for the following:

- `entity.name.function.db.osiris`
- `entity.name.function.proc.osiris`
- `entity.name.function.qry.osiris`

Coloring for builtin functions is handled by semantic highlighting. To provide support for these, add definitions for the following to the `semanticTokenColors` object in your `tmTheme` file and ensure that `semanticHighlighting` is set to `true`:

- `query`
- `call`
- `event`

## Settings

The following configuration options allow the user to customize dependency loading.

- `bg3Osiris.dependencyPaths`
    - Determines where the extension should search for dependencies. Entries in this setting should be strings that represent absolute paths to directories containing `.pak` files that are mods for Divinity Engine games. To be loaded, a `.pak` file must contain a `story.div.osi` file along with any raw goal files in `Story/RawFiles/Goals`.

- `bg3Osiris.baseMods.game`
    - The base mods that should always be loaded regardless of the dependencies in a mod's `meta.lsx` file. Unless `None` is selected, the `.pak` files specified in `bg3Osiris.baseMods.customPaths` will also be loaded.
    - Default: `Baldur's Gate 3`
    - Available values:
        - `Baldur's Gate 3`: Load pre-bundled data that contains story information for Baldur's Gate 3's `Shared`, `SharedDev`, `Gustav`, and `GustavDev` mods.
        - `Custom Only`: Load only the base mods specified in `bg3Osiris.baseMods.customPaths`.
        - `None`: Load no base mods.

- `bg3Osiris.baseMods.customPaths`
    - A list of paths to `.pak` files that should always be loaded regardless of the dependencies in a mod's `meta.lsx` file. To be loaded, a `.pak` file must contain a `story.div.osi` file along with any raw goal files in `Story/RawFiles/Goals`.

## Feedback

For bug reporting, please create an [issue](https://github.com/SASUKE38/bg3-osiris/issues/) on GitHub.

## License

This extension is distributed under the MIT license.

This extension uses LSLib, which is distributed under the MIT license.
