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

const ticketMap = new Map(); // userId -> { channelId, status, logs }

// Utility
const now = () => new Date().toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });

// Presence
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} is online`);
  client.user.setPresence({
    activities: [{ name: "🎫 DM Support", type: 3 }],
    status: "online"
  });
});

// Slash command
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
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash command /botclaim geregistreerd");
  } catch (error) {
    console.error(error);
  }
});

// /botclaim → ticketpaneel in server
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "botclaim") return;

  const channel = interaction.options.getChannel("kanaal");

  const embed = new EmbedBuilder()
    .setTitle("📩 Zandbank Roleplay - Ticket Creating")
    .setDescription(
      "Ticket Regels:\n\n" +
      "● Maak geen klachtenticket zonder bewijs.\n" +
      "● Lees eerst de FAQ voordat je een ticket opent.\n" +
      "● Noem of tag geen staffleden in je ticket.\n" +
      "● Maak geen tickets voor de grap of misbruik.\n" +
      "● Je kunt in het ticketsysteem zien hoelang het gemiddeld duurt voor er een reactie komt."
    )
    .setColor("Yellow");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_klacht").setLabel("Klacht").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_vraag").setLabel("Vraag").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ticket_partner").setLabel("Partnership").setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ Ticketpaneel verstuurd naar ${channel}`, ephemeral: true });
});

// Ticket start → DM bevestiging
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const member = interaction.member;
  let type = "";
  if (interaction.customId === "ticket_klacht") type = "Klacht";
  if (interaction.customId === "ticket_vraag") type = "Vraag";
  if (interaction.customId === "ticket_partner") type = "Partnership";
  if (!type) return;

  // Ticket in map
  ticketMap.set(member.id, { status: "pending", type, logs: [] });

  // DM met bevestiging
  try {
    const embed = new EmbedBuilder()
      .setTitle("🏷️ BEVESTIG UW TICKET!")
      .setDescription(`Bent u zeker dat **${type}** het onderwerp is waarover u een ticket wilt openen?\n\nPowered by ZBRP ⚡•${now()}`)
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_cancel").setLabel("❌ Annuleren").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_confirm").setLabel("✅ Bevestigen").setStyle(ButtonStyle.Success)
    );

    await member.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: "✅ Check je DM om je ticket te bevestigen!", ephemeral: true });
  } catch {
    await interaction.reply({ content: "⚠️ Kon geen DM sturen, zorg dat je DM’s open staan.", ephemeral: true });
  }
});

// DM bevestiging → open ticket
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  const userId = interaction.user.id;
  const ticket = ticketMap.get(userId);
  if (!ticket) return;

  const guild = client.guilds.cache.first(); // pak je hoofdserver
  const staffRoleId = "STAFF_ROLE_ID";
  const categoryId = "TICKET_CATEGORY_ID";

  if (interaction.customId === "ticket_cancel") {
    ticketMap.delete(userId);
    return interaction.update({ embeds: [new EmbedBuilder().setDescription("❌ Ticket geannuleerd.").setColor("Red")], components: [] });
  }

  if (interaction.customId === "ticket_confirm") {
    // Maak server kanaal
    const ticketChannel = await guild.channels.create({
      name: `ticket-${ticket.type.toLowerCase()}-${interaction.user.username}`,
      type: 0,
      parent: categoryId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: staffRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    ticket.channelId = ticketChannel.id;
    ticket.status = "open";

    const embed = new EmbedBuilder()
      .setTitle("🎟️ TICKET GEOPEND!")
      .setDescription(`Hey ${interaction.user},\n\nBedankt voor uw **${ticket.type}** ticket. Onze medewerkers zijn op de hoogte gebracht en zullen binnenkort reageren.\n\nPowered by ZBRP ⚡•${now()}`)
      .setColor("Blue");

    await interaction.update({ embeds: [embed], components: [] });
    await ticketChannel.send(`📩 Nieuw **${ticket.type}** ticket van ${interaction.user.tag}`);
  }
});
