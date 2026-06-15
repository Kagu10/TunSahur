// бот для новостей

const Discord = require('discord.js');
const fs = require('fs');
const Parser = require('rss-parser');
const parser = new Parser();

const config = require('./config.json');

const client = new Discord.Client();

// массив для отправленных новостей
let sentNews = [];


if(fs.existsSync('./sent.json')) {
    const data = fs.readFileSync('./sent.json', 'utf8');
    const jsonData = JSON.parse(data);
    sentNews = jsonData.sent;
}

// список rss лент
let feeds = [];

if(fs.existsSync('./rss_feeds.json')) {
    const data = fs.readFileSync('./rss_feeds.json', 'utf8');
    const jsonData = JSON.parse(data);
    feeds = jsonData.feeds;
}


function saveSentNews() {
    const toSave = { sent: sentNews };
    fs.writeFileSync('./sent.json', JSON.stringify(toSave, null, 2));
}


async function checkNews() {
    console.log('проверяю новости...');
    
    for(let i = 0; i < feeds.length; i++) {
        const feed = feeds[i];
        
        try {
            const rss = await parser.parseURL(feed.url);
            const lastNews = rss.items[0];
            
            if(!lastNews) continue;
            
            const newsId = lastNews.link + '_' + feed.name;
            
            if(!sentNews.includes(newsId)) {
                sentNews.push(newsId);
                saveSentNews();
                
                let date = 'дата неизвестна';
                if(lastNews.pubDate) {
                    let d = new Date(lastNews.pubDate);
                    date = d.getDate() + '.' + (d.getMonth()+1) + '.' + d.getFullYear() + ' ' + d.getHours() + ':' + d.getMinutes();
                }
                
                let desc = lastNews.contentSnippet || lastNews.content || 'описания нет';
                if(desc.length > 200) {
                    desc = desc.substring(0, 200) + '...';
                }
                
                const embed = new Discord.MessageEmbed()
                    .setTitle(lastNews.title || 'без заголовка')
                    .setDescription(desc)
                    .setURL(lastNews.link)
                    .setColor('#00aa00')
                    .addField('источник', feed.name, true)
                    .addField('дата', date, true);
                
                let newsChannel = null;
                const channels = client.channels.cache;
                for(let ch of channels) {
                    if(ch[1].name === 'новости') {
                        newsChannel = ch[1];
                        break;
                    }
                }
                
                if(newsChannel) {
                    await newsChannel.send(embed);
                    console.log('отправлено: ' + lastNews.title);
                } else {
                    console.log('канал #новости не найден!');
                }
            }
        } catch(err) {
            console.log('ошибка при проверке ' + feed.url + ': ' + err.message);
        }
    }
}

// когда бот запустился
client.once('ready', () => {
    console.log('бот запущен! имя: ' + client.user.tag);
    console.log('источников: ' + feeds.length);
    
    // первая проверка через 5 секунд
    setTimeout(() => {
        checkNews();
    }, 5000);
    
    // проверка каждые 10 минут
    setInterval(() => {
        checkNews();
    }, 10 * 60 * 1000);
});

// обработка команд
client.on('message', (message) => {
    if(message.author.bot) return;
    if(!message.content.startsWith(config.prefix)) return;
    
    const args = message.content.slice(config.prefix.length).trim().split(' ');
    const command = args[0];
    
    // !news
    if(command === 'news') {
        message.reply('проверяю новости...').then(async (msg) => {
            await checkNews();
            msg.edit('✅ готово! новости в канале #новости');
        });
    }
    
    // !sources
    if(command === 'sources') {
        let sourcesList = '📰 **Список источников:**\n';
        for(let i = 0; i < feeds.length; i++) {
            sourcesList += `• ${feeds[i].name}\n`;
        }
        message.reply(sourcesList);
    }
    
    // !stats 
    if(command === 'stats') {
        const totalSent = sentNews.length;
        const sourcesCount = feeds.length;
        message.reply(`📊 **Статистика:**\n• Отправлено новостей: ${totalSent}\n• Источников: ${sourcesCount}\n• Проверка раз в 10 минут`);
    }
    
    // !test 
    if(command === 'test') {
        message.reply('✅ бот работает! команды: !news, !sources, !stats, !help');
    }
    
    // !help
    if(command === 'help') {
        const helpMessage = `📰 **Новостной агрегатор — команды**

!news — проверить новости прямо сейчас
!sources — список отслеживаемых источников
!stats — статистика бота
!help — это сообщение`;
        message.reply(helpMessage);
    }
});

client.login(config.token);
