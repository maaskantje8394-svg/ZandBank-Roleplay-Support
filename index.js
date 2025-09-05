// Imports
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
  Routes
} = require("discord.js");
const express = require("express");
require("dotenv").config();

// Express server voor uptime ping
const app = express();
app.get("/", (req, res) => res.send("Bot draait ✅"));
app.listen(3000, () => console.log("🌐 Express server gestart op poort 3000"));

// Client init
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// IDs
const GUILD_ID = "1391369587697913927";
const STAFF_ROLE_ID = "1413273783745118252";
const TICKET_CATEGORY_ID = "1413273557093318748";

// Presence
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} is online`);
  client.user.setPresence({
    activities: [{ name: "Zandbank Roleplay Support | /botclaim", type: 0 }],
    status: "online"
  });
});

// Slash command /botclaim
const commands = [
  new SlashCommandBuilder()
    .setName("botclaim")
    .setDescription("Stuur het ticketpaneel naar een kanaal")
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

// Slash command handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "botclaim") {
    const channel = interaction.options.getChannel("kanaal");

    const embed = new EmbedBuilder()
      .setTitle("📩 Zandbank Roleplay – Ticket Creating")
      .setDescription(
        "Ticket Regels:\n\n" +
        "● Maak geen klachtenticket zonder bewijs.\n" +
        "● Lees eerst de FAQ voordat je een ticket opent.\n" +
        "● Noem of tag geen staffleden in je ticket.\n" +
        "● Maak geen tickets voor de grap of misbruik.\n" +
        "● Je kunt in het systeem zien hoe lang het gemiddeld duurt voor reactie."
      )
      .setColor("Yellow");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_question")
        .setLabel("❓ Vragen")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_complaint")
        .setLabel("⚠️ Klacht")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("ticket_partner")
        .setLabel("🤝 Partnerschap")
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticketpaneel verstuurd naar ${channel}`, ephemeral: true });
  }
});

// Ticket openen via DM
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const category = interaction.customId.split("_")[1];
  const categories = {
    question: "Vragen",
    complaint: "Klacht",
    partner: "Partnerschap"
  };

  if (categories[category]) {
    const confirmEmbed = new EmbedBuilder()
      .setTitle("🏷️ BEVESTIG UW TICKET!")
      .setDescription(`Bent u zeker dat **${categories[category]}** het onderwerp is waarover u een ticket wilt openen?`)
      .setFooter({ text: `Powered by ZBRP ⚡ • ${new Date().toLocaleDateString()}` })
      .setColor("Yellow");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_cancel_${category}`).setLabel("❌ Annuleren").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_confirm_${category}`).setLabel("✅ Bevestigen").setStyle(ButtonStyle.Success)
    );

    try {
      await interaction.user.send({ embeds: [confirmEmbed], components: [row] });
      await interaction.reply({ content: "📩 Controleer je DM om je ticket te bevestigen.", ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Ik kon je geen DM sturen. Zorg dat je DM’s openstaan.", ephemeral: true });
    }
  }
});

// Confirm / Cancel handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const [action, type, userId] = interaction.customId.split("_");

  if (action === "ticket" && type === "cancel") {
    await interaction.reply({ content: "❌ Ticket geannuleerd.", ephemeral: true });
    return;
  }

  if (action === "ticket" && type === "confirm") {
    const guild = await client.guilds.fetch(GUILD_ID);

    // Kanaal aanmaken
    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.id, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] },
        { id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages"] }
      ]
    });

    // Bericht in kanaal
    const openEmbed = new EmbedBuilder()
      .setTitle("🎟️ Nieuw Ticket")
      .setDescription(`Ticket aangemaakt door ${interaction.user}. Wacht op een medewerker om te claimen.`)
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_claim_${interaction.user.id}`).setLabel("Claim").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_close_${interaction.user.id}`).setLabel("Sluiten").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [openEmbed], components: [row] });

    // DM naar user
    const dmEmbed = new EmbedBuilder()
      .setTitle("🎟️ TICKET GEOPEND!")
      .setDescription(
        `Hey ${interaction.user},\n\nBedankt voor uw **${type}** ticket. Onze medewerkers zijn op de hoogte gebracht en zullen binnenkort reageren.\n\nEven geduld alstublieft tot we een medewerker hebben toegewezen.`
      )
      .setFooter({ text: `Powered by ZBRP ⚡ • ${new Date().toLocaleDateString()}` })
      .setColor("Blue");

    await interaction.user.send({ embeds: [dmEmbed] });
    await interaction.reply({ content: `✅ Ticket aangemaakt in ${channel}`, ephemeral: true });
  }
});

// Claim en Close handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  const [action, mode, userId] = interaction.customId.split("_");
  if (action !== "ticket") return;

  if (mode === "claim") {
    const embed = new EmbedBuilder()
      .setTitle("👤 TICKET IN BEHANDELING!")
      .setDescription(
        `Hey <@${userId}>,\n\nDe medewerker ${interaction.user} is toegewezen aan uw ticket en zal binnenkort reageren.`
      )
      .setFooter({ text: `Powered by ZBRP ⚡ • ${new Date().toLocaleDateString()}` })
      .setColor("Blue");

    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch {}

    await interaction.channel.send(`✅ Dit ticket is geclaimd door **${interaction.user.username}**`);

    // Knoppen aanpassen -> alleen sluiten
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_close_${userId}`).setLabel("Sluiten").setStyle(ButtonStyle.Danger)
    );
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    const ticketMsg = messages.find(m => m.components.length > 0);
    if (ticketMsg) await ticketMsg.edit({ components: [row] });

    await interaction.reply({ content: "Je hebt dit ticket succesvol geclaimd.", ephemeral: true });
  }

  if (mode === "close") {
    const embed = new EmbedBuilder()
      .setTitle("📨 TICKET GESLOTEN!")
      .setDescription(
        `Hey <@${userId}>,\n\nOnze medewerkers hebben uw verzoek als opgelost gemarkeerd en uw ticket gesloten.\n\nHeeft u nog vragen? Open gerust een nieuw ticket.\n\nBedankt voor uw bericht.\n\nMvg,\nGRP Support-team\n\nℹ️ Waarschuwing\nAls u reageert, wordt een nieuw verzoek geopend.`
      )
      .setFooter({ text: `Powered by ZBRP ⚡ • ${new Date().toLocaleDateString()}` })
      .setColor("Blue");

    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch {}

    await interaction.reply({ content: "❌ Ticket wordt gesloten...", ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
  }
});

// Start bot
client.login(process.env.DISCORD_TOKEN);
