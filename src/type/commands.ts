import { ChatInputCommandInteraction, Client, SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js'

export type CommandListener = (interaction: ChatInputCommandInteraction, client: Client) => void | Promise<void>

// Command

type CommandBuilderType = SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder

export type CommandType = {
    builder: CommandBuilderType,
    listener: CommandListener,
}

export function Command(command: CommandType): CommandType
export function Command(builder: CommandBuilderType, listener: CommandListener): CommandType
export function Command(arg1: CommandType | CommandBuilderType, arg2?: CommandListener): CommandType {
    if (arg2) {
        return {builder: arg1 as CommandBuilderType, listener: arg2}
    }
    return arg1 as CommandType
}

export const isCommandType = (command: {}): command is CommandType => 'builder' in command && 'listener' in command

// SubCommand

type SubCommandBuilderType = SlashCommandSubcommandBuilder | ((subcommandGroup: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder)

export type SubCommandType = {
    builder: SubCommandBuilderType,
    listener: CommandListener,
}

export function SubCommand(subCommand: SubCommandType): SubCommandType
export function SubCommand(builder: SubCommandBuilderType, listener: CommandListener): SubCommandType
export function SubCommand(arg1: SubCommandType | SubCommandBuilderType, arg2?: CommandListener): SubCommandType {
    if (arg2) {
        return {builder: arg1 as SubCommandBuilderType, listener: arg2}
    }
    return arg1 as SubCommandType
}

export const isSubCommandType = (subCommand: {}): subCommand is SubCommandType => 'builder' in subCommand && 'listener' in subCommand