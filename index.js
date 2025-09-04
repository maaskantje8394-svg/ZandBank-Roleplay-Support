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
  PermissionsBitField,
  AttachmentBuilder
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

const ticketMap = new Map(); // userId -> { channelId, status, logs, type, staff }

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
      .setDescription(
        `Bent u zeker dat **${type}** het onderwerp is waarover u een ticket wilt openen?\n\n` +
        `Powered by ZBRP ⚡•${now()}`
      )
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

  // IDs van jouw server
  const guild = await client.guilds.fetch("1391369587697913927");
  const staffRoleId = "1413273783745118252";
  const categoryId = "1413273557093318748";

  if (interaction.customId === "ticket_cancel") {
    ticketMap.delete(userId);
    return interaction.update({
      embeds: [new EmbedBuilder().setDescription("❌ Ticket geannuleerd.").setColor("Red")],
      components: []
    });
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

    const claimRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_claim_${userId}`).setLabel("Claim").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket_close_${userId}`).setLabel("Sluiten").setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
      .setTitle("🎟️ TICKET GEOPEND!")
      .setDescription(
        `Hey ${interaction.user},\n\n` +
        `Bedankt voor uw **${ticket.type}** ticket. Onze medewerkers zijn op de hoogte gebracht en zullen binnenkort reageren.\n\n` +
        `Powered by ZBRP ⚡•${now()}`
      )
      .setColor("Blue");

    await interaction.update({ embeds: [embed], components: [] });
    await ticketChannel.send({ content: `📩 Nieuw **${ticket.type}** ticket van ${interaction.user.tag}`, components: [claimRow] });
  }
});

// Claim en close knoppen
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  // claim
  if (interaction.customId.startsWith("ticket_claim_")) {
    const userId = interaction.customId.split("_")[2];
    const ticket = ticketMap.get(userId);
    if (!ticket) return interaction.reply({ content: "⚠️ Ticket niet gevonden.", ephemeral: true });

    ticket.staff = interaction.user.username;
    ticket.status = "claimed";

    const embed = new EmbedBuilder()
      .setTitle("👤 TICKET IN BEHANDELING!")
      .setDescription(
        `Hey <@${userId}>,\n\n` +
        `De medewerker **${interaction.user.username}** is toegewezen tot uw ticket en zal binnenkort reageren.\n\n` +
        `Powered by ZBRP ⚡•${now()}`
      )
      .setColor("Blue");

    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch {}

    await interaction.reply({ content: `✅ Ticket geclaimd door ${interaction.user.username}.`, ephemeral: true });
  }

  // close
  if (interaction.customId.startsWith("ticket_close_")) {
    const userId = interaction.customId.split("_")[2];
    const ticket = ticketMap.get(userId);
    if (!ticket) return interaction.reply({ content: "⚠️ Ticket niet gevonden.", ephemeral: true });

    ticket.status = "closed";

    // maak logbestand
    const logText = ticket.logs.join("\n") || "Geen berichten gelogd.";
    const attachment = new AttachmentBuilder(Buffer.from(logText, "utf-8"), { name: "ticket-log.txt" });

    const embed = new EmbedBuilder()
      .setTitle("📨 TICKET GESLOTEN!")
      .setDescription(
        `Hey <@${userId}>,\n\n` +
        `Onze medewerkers hebben uw verzoek als opgelost gemarkeerd en uw ticket gesloten.\n\n` +
        `Heeft u nog vragen? Open gerust een nieuw ticket.\n\n` +
        `Bedankt voor uw bericht.\n\n` +
        `Mvg,\nGRP Support-team\n\n` +
        `ℹ️ Waarschuwing\nAls u op dit bericht reageert, wordt een nieuw ondersteuningsverzoek geopend.\n\n` +
        `📑 Ticket-logboek is bijgevoegd.\n\n` +
        `Powered by ZBRP ⚡•${now()}`
      )
      .setColor("Blue");

    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed], files: [attachment] });
    } catch {}

    const channel = await client.channels.fetch(ticket.channelId);
    if (channel) await channel.delete().catch(() => null);

    ticketMap.delete(userId);
    await interaction.reply({ content: "✅ Ticket gesloten.", ephemeral: true });
  }
});

// Chat bridge
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // staff → user
  const ticket = [...ticketMap.values()].find(t => t.channelId === message.channel.id);
  if (ticket) {
    const user = await client.users.fetch([...ticketMap.entries()].find(([id, t]) => t.channelId === message.channel.id)[0]);
    const content = `> [WERKNEMER] **${message.author.username}**: ${message.content}`;
    ticket.logs.push(content);
    try {
      await user.send(content);
    } catch {}
  }

  // user → staff
  if (message.channel.type === 1) { // DM
    const ticket = ticketMap.get(message.author.id);
    if (ticket && ticket.status !== "closed") {
      const channel = await client.channels.fetch(ticket.channelId);
      if (channel) {
        const content = `> [USER] **${message.author.username}**: ${message.content}`;
        ticket.logs.push(content);
        await channel.send(content);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
