import { ChatInputCommandInteraction, Client, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js"

export type RunFunction = (interaction: ChatInputCommandInteraction, client: Client) => void|Promise<void>

export type CommandType = {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder,
    run: RunFunction,
}

export class Command {
    constructor(commandOptions: CommandType) {
        Object.assign(this, commandOptions)
    }
}