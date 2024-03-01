import { ActionRowBuilder, EmbedBuilder, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js'
import { Command } from '../../typing/commands.ts'
import { query, transaction } from '../../db.ts'
import { combination, groupBy, logObject, zip } from '../../utils/functions.ts'
import { ValidationError } from '../../utils/classes.ts'


const makePollEmbed = (data: any) => {
    const embed = new EmbedBuilder()
        .setTitle(`「${data.title}」`)
        .setAuthor({name: '投票'})
        .addFields({name: 'example', value: '3', inline: false})
        .setFooter({text: `${'≡'.repeat(43)}\n點擊下面選單以投票`})
    const component = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .addOptions({label: 'example 1', value: '0'}, {label: 'example 2', value: '1'}, {label: 'example 3', value: '2'})
                .setCustomId('')
        )
    return {embed, component}
}

export default new Command({
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('?')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set bot\'s avatar.')
                .setDescriptionLocalization('zh-TW', '設置機器人的大頭貼')
                .addStringOption(option =>
                    option.setName('link')
                        .setNameLocalization('zh-TW', '連結')
                        .setDescription('Link of the image.')
                        .setDescriptionLocalization('zh-TW', '圖片連結。')
                        .setRequired(false))
                .addAttachmentOption(option =>
                    option.setName('file')
                        .setNameLocalization('zh-TW', '檔案')
                        .setDescription('The image file.')
                        .setDescriptionLocalization('zh-TW', '圖片檔案。')
                        .setRequired(false))
        ),
    run: async (ctx, client) => {
        const subcommand = ctx.options.getSubcommand()
        const subfunctions: {[key: string]: () => Promise<void>} = {
            'set': async () => {
                const link      = ctx.options.getString('link')
                const file      = ctx.options.getAttachment('file')
                await ctx.deferReply({ephemeral: true})

                if (link == null && file == null) {
                    await ctx.editReply({content: 'You must provide at least one option!'});
                    return
                }

                await client.user?.setAvatar(file?.url ?? link)

                await ctx.editReply({content: 'Avatar set!'});
            }
        }
        subcommand in subfunctions && await subfunctions[subcommand]()
    }
})