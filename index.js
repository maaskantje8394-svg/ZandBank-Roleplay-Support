const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require("discord.js");
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

// Presence + login
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} is online`);

  client.user.setPresence({
    activities: [
      { name: "Zandbank Roleplay Support Dm mij voor hulp.",type: 0 }
    ],
    status: "online"
  });
});

// Register slash command (/botclaim)
const commands = [
  new SlashCommandBuilder()
    .setName("botclaim")
    .setDescription("Stuur het ticket paneel naar een gekozen kanaal")
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

// Command handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "botclaim") {
    const channel = interaction.options.getChannel("kanaal");

    const embed = new EmbedBuilder()
      .setTitle("📩 Zandbank Roleplay – Ticket Creating")
      .setDescription(
        "Ticket Regels:\n" +
        "● Maak geen klachten zonder bewijs.\n" +
        "● Lees eerst de FAQ voor je opent.\n" +
        "● Geen staffleden taggen.\n" +
        "● Geen misbruik van tickets.\n" +
        "● Status: Blauw = Altijd Open, Groen = Tijdelijk Open, Rood = Gesloten."
      )
      .setColor("Blue");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("general_support")
        .setLabel("General-Support")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("player_report")
        .setLabel("Player-Report")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("staff_complaint")
        .setLabel("Staff Complaint")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket paneel verstuurd naar ${channel}`, ephemeral: true });
  }
});

// Button handler (test output)
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "general_support") {
    await interaction.reply({ content: "📩 Je koos **General Support** (dit is een test).", ephemeral: true });
  }
  if (interaction.customId === "player_report") {
    await interaction.reply({ content: "📩 Je koos **Player Report** (dit is een test).", ephemeral: true });
  }
  if (interaction.customId === "staff_complaint") {
    await interaction.reply({ content: "📩 Je koos **Staff Complaint** (dit is een test).", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
