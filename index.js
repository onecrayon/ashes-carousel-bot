require('dotenv').config(); //initialize dotenv
const { Client, Intents, MessageEmbed } = require('discord.js');
const AshesLive = require('./algo/asheslive');
const Carousel = require('./algo/carousel');
const Forge = require('./algo/forge');
const NamePairer = require('./algo/NamePairer');
const Validator = require('./algo/validator');
const BotDataService = require('./data/BotDataService');
const TextExporter = require('./export/textexporter');
const util = require('./util');


let carousel = new Carousel();
const client = new Client({
    intents: [
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_MEMBERS
    ],
    partials: ['MESSAGE', 'CHANNEL']
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async msg => {
    const parts = msg.content.split(' ');
    let command = null;
    if (parts.length > 0 && parts[0].length > 0) {
        command = parts[0].slice(1).toLocaleLowerCase();
    }
    // only response if carousel is requested
    if (['!carousel', '!car'].includes(parts[0])) {
        if (parts.length === 1) {
            // single nameless carousel return
            msg.reply(carousel.getCarouselEntry());
        }
        else {
            // bulk request
            let reply = '';
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                reply += part + ': ' + carousel.getCarouselEntry() + '\n';
                if (reply.length > 1950) {
                    msg.reply(reply);
                    reply = '';
                }
            }
            msg.reply(reply);
        }
    }

    if (parts[0] === '!rando') {
        const caro = carousel.getCarousel();
        const diceString = caro.dice.map((dObj) => dObj.text).join('');
        const deckText = new TextExporter().export(new Forge().createDeck(caro.pb.stub, diceString));
        msg.reply(deckText);
    }

    if (parts[0] === '!coaloff') {
        const caro = carousel.getCarousel('coal-roarkwin');
        const diceString = caro.dice.map((dObj) => dObj.text).join('');
        const deck = new Forge().createDeck(caro.pb.stub, diceString, { maxCardCount: 1, noExtras: true });
        const deckText = new TextExporter().export(deck);
        msg.reply(deckText);
    }

    if (parts[0] === '!lfg') {
        const lfgRole = msg.guild.roles.cache.find(r => r.name === 'lfg');
        if (!lfgRole) {
            msg.channel.send('no lfg role found');
        }

        if (parts[1] === 'list') {
            const members = lfgRole.members;
            console.log(members.size);
            const memberNames = members.sort((a, b) => a.displayName.toLowerCase() < b.displayName.toLowerCase() ? -1 : 1)
                .map(m => m.displayName);
            const listEmbed = new MessageEmbed()
                .setTitle(`Players who are lfg (${memberNames.length}):`)
                .setDescription(memberNames.join('\n'));

            msg.channel.send({ embeds: [listEmbed] });
        }

        if (parts.length === 1 || (parts.length === 2 && parts[1] === 'on')) {
            msg.member.roles.add(lfgRole);
            msg.channel.send(msg.member.displayName + ' added to the @lfg role');
        }
        if ((parts.length === 2 && parts[1] === 'off')) {
            msg.member.roles.remove(lfgRole);
            msg.channel.send(msg.member.displayName + ' lfg off');
        }
    }
    const roleNames = {
        ffl: 'first-five-league',
        phx: 'phoenix-league'
    }

    // check for role command
    if (Object.keys(roleNames).includes(command)) {
        let discordRole = msg.guild.roles.cache.find(r => r.name === roleNames[command]);
        if (!discordRole) {
            msg.channel.send('role not found: ' + command);
            return;
        }

        if (parts.length > 1) {
            const action = parts[1];

            if (action === 'list') {
                const memberNames = discordRole.members.sort((a, b) => a.displayName.toLowerCase() < b.displayName.toLowerCase() ? -1 : 1)
                    .map(m => m.displayName);
                const listEmbed = new MessageEmbed()
                    .setTitle(`Players in the league (${memberNames.length}):`)
                    .setDescription(memberNames.join('\n'));

                msg.channel.send({ embeds: [listEmbed] });
            }

            if (action === 'pair') {
                try {
                    const save = parts.length > 2 && parts[2] === 's';

                    const dataService = new BotDataService();
                    const latest = await dataService.getLatest(command);

                    const memberNames = discordRole.members.sort((a, b) => a.displayName.toLowerCase() < b.displayName.toLowerCase() ? -1 : 1)
                        .map(m => m.displayName);
                    const pairer = new NamePairer();
                    const pairs = pairer.pair(memberNames, latest?.pairings);

                    if (save) {
                        dataService.saveLatest(command, pairs);
                    }

                    const listEmbed = new MessageEmbed()
                        .setTitle('Random pairings:')
                        .setDescription(pairs.map((p, i) => `${i + 1}. ${p.player1} vs ${p.player2}`).join('\n'));

                    msg.channel.send({ embeds: [listEmbed] });
                } catch (e) {
                    msg.channel.send('unable to pair due to error:', e);
                }
            }

            if (action === 'latest') {
                try {
                    const dataService = new BotDataService();
                    const latest = await dataService.getLatest(command);

                    const listEmbed = new MessageEmbed()
                        .setTitle(command + ' latest:')
                        .setDescription(latest.datePaired + '\n' + latest.pairings.map((p, i) => `${i + 1}. ${p.player1} vs ${p.player2}`).join('\n'));

                    msg.channel.send({ embeds: [listEmbed] });
                } catch (e) {
                    msg.channel.send('unable to get latest due to error:', e);
                }
            }

            if (action === 'previous') {
                try {
                    const dataService = new BotDataService();
                    const latestTwo = await dataService.getPrevious(command);

                    if (latestTwo.length === 2) {
                        latest = latestTwo[1];

                        const listEmbed = new MessageEmbed()
                            .setTitle(command + ' previous:')
                            .setDescription(latest.datePaired + '\n' + latest.pairings.map((p, i) => `${i + 1}. ${p.player1} vs ${p.player2}`).join('\n'));

                        msg.channel.send({ embeds: [listEmbed] });
                    } else {
                        msg.channel.send('not found');
                    }
                } catch (e) {
                    msg.channel.send('unable to get latest due to error:', e);
                }
            }

            if (action === 'join') {
                msg.member.roles.add(discordRole);
                msg.channel.send(msg.member.displayName + ' joined ' + roleNames[command] + '!');
            }
            if (action === 'drop') {
                msg.member.roles.remove(discordRole);
                msg.channel.send(msg.member.displayName + ' left ' + roleNames[command]);
            }
        }
    }

    if (['!trinity', '!tri'].includes(parts[0])) {
        const deckUrl = parts[1];
        const regex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
        let uuid = deckUrl.match(regex);
        try {
            let response = await util.httpRequest(`https://api.ashes.live/v2/decks/shared/${uuid}`);

            if (response[0] === '<') {
                logger.error('Deck failed to download: %s %s', deck.uuid, response);

                throw new Error('Invalid response from api. Please try again later.');
            }

            deckResponse = JSON.parse(response);
        } catch (error) {
            logger.error(`Unable to get deck ${deck.uuid}`, error);

            throw new Error('Invalid response from Api. Please try again later.');
        }

        if (!deckResponse || !deckResponse.cards) {
            throw new Error('Invalid response from Api. Please try again later.');
        }

        let newDeck = new AshesLive().parseAshesLiveDeckResponse('user', deckResponse);
        const res = new Validator().validateTrinityDeck(newDeck)
        let header = newDeck.name + ' is ';
        header += !res.valid ? 'not ' : '';
        header += 'valid for trinity format:\n'
        let message = 'Master Set: ';
        message += res.core ? 'Yes\n' : 'No\n';
        message += 'Deluxe: ' + res.deluxe.join(', ') + '\n';
        message += `Packs (${res.packs.length}): ` + res.packs.join(', ') + '\n';
        const listEmbed = new MessageEmbed()
            .setTitle(header)
            .setDescription(message);

        msg.channel.send({ embeds: [listEmbed] });
    }
});


//make sure this line is the last line
client.login(process.env.CLIENT_TOKEN); //login bot using token