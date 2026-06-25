-- ====================================================================
--      GROW A GARDEN 2 - REAL-TIME NOTIFIER LOADSTRING ENGINE
-- ====================================================================

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")

-- Membaca webhook dari global variable (_G) atau menggunakan webhook default milik Anda
local SEED_WEBHOOK_URL     = _G.SEED_WEBHOOK or "https://discord.com/api/webhooks/1519720299531206778/o78q2lQAEX_qOCgf55KLnDQ5-ZUzvSFZdiGMjMHbzIwF6Jcez-bI1S4s8QT2lWvKsazM"
local GEAR_WEBHOOK_URL     = _G.GEAR_WEBHOOK or "https://discord.com/api/webhooks/1519720301494141111/azJ7BWfZSg4RwfiVFlf9Dp95tGI8WHUCL6us5j__lQbQQV0WI-RSLH492AenSz753mIG"
local PRED_WEBHOOK_URL     = _G.PRED_WEBHOOK or "https://discord.com/api/webhooks/1519720303368868032/1Ugd5QM8WLqjP0brqcw-0sszPL1ajbTKi5voYXWJ1gvqyLNzERv_5lman3e_H5E4FyJD"
local WEATHER_WEBHOOK_URL  = _G.WEATHER_WEBHOOK or "https://discord.com/api/webhooks/1519720305818603636/yVZ7ezv1sruBz1BXw-aWlvZzXaiNLZWUowLp0apYuBhAG_NNbL53dI4Th1bgPzQbdcv0"

-- Proxy untuk memotong blokir request Roblox ke Discord API
local function getProxyUrl(url)
    if not url or url == "" then return nil end
    return url:gsub("discord.com", "webhook.lewisakura.moe")
              :gsub("discordapp.com", "webhook.lewisakura.moe")
end

-- Fungsi mengirim embed ke webhook spesifik
local function sendToWebhook(webhookUrl, title, description, fields, color)
    local proxy = getProxyUrl(webhookUrl)
    if not proxy then return end
    
    local payload = HttpService:JSONEncode({
        embeds = {
            {
                title = title,
                description = description,
                fields = fields,
                color = color or 5814783,
                timestamp = DateTime.now():ToIsoDate(),
                footer = {
                    text = "GAG2 Real-time Monitor · Powered by Antigravity"
                }
            }
        }
    })
    
    local success, err = pcall(function()
        return HttpService:PostAsync(proxy, payload, Enum.HttpContentType.ApplicationJson)
    end)
    
    if not success then
        warn("⚠️ Gagal mengirim webhook [" .. title .. "]: " .. tostring(err))
    else
        print("✅ Berhasil mengirim webhook [" .. title .. "]")
    end
end

-- Fungsi utama untuk membaca GUI dan membagikan stok terpisah
local function scanAndPostStock()
    local seedsText = ""
    local gearsText = ""
    local weatherText = "Sunny ☀️"
    
    -- Membaca status cuaca di kebun
    local mainGui = PlayerGui:FindFirstChild("MainGui") or PlayerGui:FindFirstChild("HUD")
    if mainGui then
        local weatherFrame = mainGui:FindFirstChild("WeatherFrame") or mainGui:FindFirstChild("Weather")
        if weatherFrame and weatherFrame:FindFirstChild("WeatherLabel") then
            weatherText = weatherFrame.WeatherLabel.Text
        end
    end
    
    -- Membaca UI Toko milik NPC Sam (Seed & Gear Shop)
    local shopGui = PlayerGui:FindFirstChild("ShopGui") or PlayerGui:FindFirstChild("MerchantGui")
    if shopGui and shopGui.Enabled then
        local container = shopGui:FindFirstChild("Container") or shopGui:FindFirstChild("Frame")
        if container then
            -- Cari bagian Seed
            local seedSection = container:FindFirstChild("Seeds") or container:FindFirstChild("SeedScroll")
            if seedSection then
                for _, item in ipairs(seedSection:GetChildren()) do
                    if item:IsA("Frame") and item:FindFirstChild("ItemName") then
                        local name = item.ItemName.Text
                        local stock = item:FindFirstChild("Stock") and item.Stock.Text or "In Stock"
                        local price = item:FindFirstChild("Price") and item.Price.Text or "Free"
                        seedsText = seedsText .. string.format("🌱 **%s**\n└ 📦 Stok: `%s` | 💵 Harga: `%s`\n\n", name, stock, price)
                    end
                end
            end
            
            -- Cari bagian Gear
            local gearSection = container:FindFirstChild("Gears") or container:FindFirstChild("GearScroll")
            if gearSection then
                for _, item in ipairs(gearSection:GetChildren()) do
                    if item:IsA("Frame") and item:FindFirstChild("ItemName") then
                        local name = item.ItemName.Text
                        local stock = item:FindFirstChild("Stock") and item.Stock.Text or "In Stock"
                        local price = item:FindFirstChild("Price") and item.Price.Text or "Free"
                        gearsText = gearsText .. string.format("🛠️ **%s**\n└ 📦 Stok: `%s` | 💵 Harga: `%s`\n\n", name, stock, price)
                    end
                end
            end
        end
    end
    
    -- Hitung Waktu Restock Berikutnya (Timer 5 Menit Global)
    local now = os.time()
    local nextRestockTime = 300 - (now % 300)
    local mins = math.floor(nextRestockTime / 60)
    local secs = nextRestockTime % 60
    local predictionText = string.format("🔄 Restock berikutnya dalam: **%d menit %d detik**", mins, secs)

    -- 1. KIRIM INFO SEEDS (Jika terdeteksi)
    if seedsText ~= "" then
        sendToWebhook(SEED_WEBHOOK_URL, "🌱 UPDATE STOK BENIH (SEEDS) - GAG2", "Stok benih aktif dari server game:", {
            { name = "Benih yang Tersedia", value = seedsText, inline = false }
        }, 3066993) -- Green
    end
    
    -- 2. KIRIM INFO GEARS (Jika terdeteksi)
    if gearsText ~= "" then
        sendToWebhook(GEAR_WEBHOOK_URL, "🛠️ UPDATE STOK PERALATAN (GEARS) - GAG2", "Stok peralatan aktif dari server game:", {
            { name = "Peralatan yang Tersedia", value = gearsText, inline = false }
        }, 15105570) -- Orange/Bronze
    end
    
    -- 3. KIRIM INFO PREDIKSI (Selalu dikirim setiap siklus)
    sendToWebhook(PRED_WEBHOOK_URL, "🔮 PREDIKSI ROTASI TOKO - GAG2", "Informasi estimasi restock server global:", {
        { name = "Waktu Restock", value = predictionText, inline = false }
    }, 10181046) -- Purple

    -- 4. KIRIM INFO STATUS CUACA (Selalu dikirim setiap siklus)
    sendToWebhook(WEATHER_WEBHOOK_URL, "🌤️ UPDATE CUACA KEBUN - GAG2", "Informasi status cuaca kebun saat ini:", {
        { name = "Status Cuaca", value = "🌡️ Cuaca: **" .. weatherText .. "**", inline = false }
    }, 3447003) -- Blue
end

-- Menjalankan pemantau otomatis setiap 30 detik
task.spawn(function()
    print("🚀 Grow a Garden 2 Multi-Webhook Notifier Aktif!")
    while true do
        local ok, err = pcall(scanAndPostStock)
        if not ok then
            warn("Error scan: " .. tostring(err))
        end
        task.wait(30) -- Deteksi & update ke masing-masing saluran setiap 30 detik
    end
end)
