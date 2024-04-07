import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url';
import { ClientEvents, Collection, REST, RESTPutAPIApplicationCommandsJSONBody, RESTPutAPIApplicationCommandsResult, Routes } from "discord.js";
import { CommandType } from './typing/commands.ts'
import { EventsWithListener } from './typing/events.ts'

const commands: RESTPutAPIApplicationCommandsJSONBody = [];
const collection = {
    commands: new Collection<string, CommandType>(),
    events: [] as EventsWithListener<keyof ClientEvents>[],
}
// Grab all the command folders from the commands directory you created earlier
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    // Grab all the command files from the commands directory you created earlier
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));
    // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
    for (const file of commandFiles) {
        const filePath = pathToFileURL(path.join(commandsPath, file)).toString();
        const imported = await import(filePath) as { default: CommandType, events?: EventsWithListener<keyof ClientEvents>[] };

        const command = imported.default
        if (command && 'data' in command && 'run' in command) {
            commands.push(command.data.toJSON());
            collection.commands.set(command.data.name, command)
        } else {
            console.log(Object.keys(command))
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "run" property.`);
        }

        const events = imported.events
        if (events) {
            collection.events.push(...events)
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN!);

// and deploy your commands!
try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const route = (process.env.GUILD_ID)
        ? Routes.applicationGuildCommands(process.env.APPLICATION_ID!, process.env.GUILD_ID)
        : Routes.applicationCommands(process.env.APPLICATION_ID!)

    // The put method is used to fully refresh all commands in the guild with the current set
    const results = (await rest.put(
        route,
        { body: commands },
    )) as RESTPutAPIApplicationCommandsResult;

    console.log(`Successfully reloaded ${results.length} application (/) commands.`);
} catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
}

export default collection