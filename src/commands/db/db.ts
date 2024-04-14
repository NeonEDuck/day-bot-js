import { SlashCommandBuilder } from 'discord.js';
import { query } from '../../db.ts';
import { Command, CommandListener } from '../../type/commands.ts';

await query(`CREATE TABLE IF NOT EXISTS accounts (
    user_id serial PRIMARY KEY,
    username VARCHAR ( 50 ) UNIQUE NOT NULL,
    password VARCHAR ( 50 ) NOT NULL,
    email VARCHAR ( 255 ) UNIQUE NOT NULL,
    last_login TIMESTAMP
);`).then(() => {
    // console.log('susccess')
})

export default Command({
    builder: new SlashCommandBuilder()
        .setName('db')
        .setDescription('?')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add user.')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('username')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('password')
                        .setDescription('password')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('email')
                        .setDescription('email')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('select')
                .setDescription('Select user.')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('The keywords you want to remove. (Separate the words with "|")')
                        .setRequired(true))
        ),
    listener: async (ctx, client) => {
        const subcommand = ctx.options.getSubcommand()
        const subfunctions: Record<string, CommandListener> = {
            'add': async () => {
                const username = ctx.options.getString('username', true)
                const password = ctx.options.getString('password', true)
                const email    = ctx.options.getString('email', true)

                let text = ''
                await query(`INSERT INTO accounts (username, password, email) VALUES ($1, $2, $3)`, [username, password, email])
                    .then(() => {
                        text = `${username} has been added`
                    }, (err) => {
                        text = `Fail to add ${username}`
                        console.log(err)
                    })
                await ctx.reply({content: text, ephemeral: true});
            },
            'select': async () => {
                const username = ctx.options.getString('username', true)
                let text = ''
                await query(`SELECT * FROM accounts WHERE username = $1::text`, ['qwe'])
                    .then((results) => {
                        if (results.rows.length > 0) {
                            const { username, password, email } = results.rows[0]
                            text = `Found ${username}, the password is ${password}, the email is ${email}`
                        }
                        else {
                            text = `${username} not found`
                        }
                    }, (err) => {
                        text = `Fail to select ${username}`
                        console.log(err)
                    })
                await ctx.reply({content: text, ephemeral: true});
            },
        }
        await subfunctions[subcommand]?.(ctx, client)
    }
})