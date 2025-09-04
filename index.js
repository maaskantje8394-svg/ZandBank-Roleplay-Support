const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Ticket koppelingen (userId -> channelId)
const ticketMap = new Map();

// Presence
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} is online`);
  client.user.setPresence({
    activities: [{ name: "🎫 DM Support", type: 3 }],
    status: "online"
  });
});

// Slash command (/botclaim)
const commands = [
  new SlashCommandBuilder()
    .setName("botclaim")
    .setDescription("Stuur het ticketpaneel naar een gekozen kanaal")
    .addChannelOption(option =>
      option.setName("kanaal")
        .setDescription("Kanaal waar het ticketpaneel komt")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

client.on("ready", async () => {
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash command /botclaim geregistreerd");
  } catch (error) {
    console.error(error);
  }
});

// /botclaim handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "botclaim") return;

  const channel = interaction.options.getChannel("kanaal");

  const embed = new EmbedBuilder()
    .setTitle("📩 Groningen Roleplay – Ticket Systeem")
    .setDescription(
      "Maak hieronder een keuze om een gesprek te starten via DM met ons supportteam.\n\n" +
      "🔴 **Klachten**\n🟢 **Vragen**\n🔵 **Partnership**"
    )
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_klacht")
      .setLabel("Klacht")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_vraag")
      .setLabel("Vraag")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_partner")
      .setLabel("Partnership")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ Ticketpaneel verstuurd naar ${channel}`, ephemeral: true });
});

// Ticket openen via knop
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;
  const member = interaction.member;
  const staffRoleId = "1413273783745118252";     // <--- vervang met staff rol id
  const categoryId = "1413273557093318748"; // <--- vervang met categorie id

  let type = "";
  if (interaction.customId === "ticket_klacht") type = "klacht";
  if (interaction.customId === "ticket_vraag") type = "vraag";
  if (interaction.customId === "ticket_partner") type = "partner";

  if (!type) return;

  // Check of user al ticket heeft
  if (ticketMap.has(member.id)) {
    return interaction.reply({ content: "❌ Je hebt al een open ticket in je DM!", ephemeral: true });
  }

  // Maak ticketkanaal
  const ticketChannel = await guild.channels.create({
    name: `ticket-${type}-${member.user.username}`,
    type: 0,
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
    ]
  });

  ticketMap.set(member.id, ticketChannel.id);

  await interaction.reply({ content: `✅ Ticket (${type}) aangemaakt. Check je DM!`, ephemeral: true });

  // DM sturen
  try {
    await member.send(`📩 Je hebt een **${type}-ticket** geopend! Typ hier je bericht, het staffteam zal reageren.`);
  } catch {
    await ticketChannel.send(`⚠️ Kon geen DM sturen naar <@${member.id}>.`);
  }
});

// Relay: DM -> ticketkanaal
client.on("messageCreate", async message => {
  if (message.channel.type !== 1) return; // alleen DM
  if (message.author.bot) return;

  const ticketChannelId = ticketMap.get(message.author.id);
  if (!ticketChannelId) return;

  const ticketChannel = await client.channels.fetch(ticketChannelId);
  if (!ticketChannel) return;

  await ticketChannel.send(`**${message.author.username}**: ${message.content}`);
});

// Relay: ticketkanaal -> DM
client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return; // alleen in server

  const userId = [...ticketMap.entries()]
    .find(([, channelId]) => channelId === message.channel.id)?.[0];
  if (!userId) return;

  const user = await client.users.fetch(userId);
  if (!user) return;

  await user.send(`[WERKNEMER] **${message.author.username}**: ${message.content}`);
});

client.login(process.env.DISCORD_TOKEN);
