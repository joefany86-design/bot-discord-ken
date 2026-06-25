-- ====================================================================
--      GROW A GARDEN 2 - REAL-TIME NOTIFIER LOADSTRING ENGINE
-- ====================================================================

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer
local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")

-- Membaca webhook dari global variable (_G) atau menggunakan webhook default milik Anda
local SEED_WEBHOOK_URL     = _G.SEED_WEBHOOK or "https://discord.com/api/webhooks/1519722003215683608/KipDCX_88tIapvhWw6ZIHCnuiRThXxEmWWPOWnT7uZ5Ap3JVZ9eRAP3k8E3HZa_aBZkp"
local GEAR_WEBHOOK_URL     = _G.GEAR_WEBHOOK or "https://discord.com/api/webhooks/1519722006273327204/azyHlhLIddjNYf2-4A5-vCS78I7t_QDu7Wt7E_L-rD-avED6_XkbeDyAblAFXgDfT8AD"
local PRED_WEBHOOK_URL     = _G.PRED_WEBHOOK or "https://discord.com/api/webhooks/1519722008361963523/rOSb_Qao7HJ_cBEJ347NjVJK3R95zguIjTkzABdtTdNgBketBURe2G9tXMtvsnPvubzf"
local WEATHER_WEBHOOK_URL  = _G.WEATHER_WEBHOOK or "https://discord.com/api/webhooks/1519722010903576647/zNK7rRzxa-uqrCuMKpwQCkCJ23hoUqGgRh-jl5YP4mz5ynEaT2Rk5Pxx_sKXd92fu60P"

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
    
    -- Deteksi fungsi HTTP request bawaan executor secara global
    local requestFunc = (syn and syn.request) or http_request or request or (http and http.request)
    
    local success, err = pcall(function()
        if requestFunc then
            local response = requestFunc({
                Url = proxy,
                Method = "POST",
                Headers = {
                    ["Content-Type"] = "application/json"
                },
                Body = payload
            })
            return response
        else
            return HttpService:PostAsync(proxy, payload, Enum.HttpContentType.ApplicationJson)
        end
    end)
    
    if not success then
        warn("⚠️ Gagal mengirim webhook [" .. title .. "]: " .. tostring(err))
    else
        print("✅ Berhasil mengirim webhook [" .. title .. "]")
    end
end

-- Fungsi utama untuk membaca GUI dan membagikan stok terpisah
local function scanAndPostStock()
    local seedsList = {}
    local gearsList = {}
    local weatherText = "Sunny ☀️"
    local restockTimer = "N/A"
    
    -- Membaca status cuaca di kebun
    local mainGui = PlayerGui:FindFirstChild("MainGui") or PlayerGui:FindFirstChild("HUD")
    if mainGui then
        local weatherFrame = mainGui:FindFirstChild("WeatherFrame") or mainGui:FindFirstChild("Weather")
        if weatherFrame and weatherFrame:FindFirstChild("WeatherLabel") then
            weatherText = weatherFrame.WeatherLabel.Text
        end
    end
    
    -- Membaca UI Toko milik NPC Sam (SeedShop)
    local seedShop = PlayerGui:FindFirstChild("SeedShop")
    if seedShop and seedShop.Enabled then
        -- Kumpulkan semua item dengan mencari "Seed_Text"
        for _, obj in ipairs(seedShop:GetDescendants()) do
            if obj.Name == "Seed_Text" and obj:IsA("TextLabel") then
                local itemFrame = obj.Parent
                if itemFrame then
                    local name = obj.Text
                    
                    local rarity = ""
                    local rarityTxt = itemFrame:FindFirstChild("Rarity_Text")
                    if rarityTxt and rarityTxt:IsA("TextLabel") then
                        rarity = rarityTxt.Text
                    end
                    
                    local stock = ""
                    local stockTxt = itemFrame:FindFirstChild("Stock_Text")
                    if stockTxt and stockTxt:IsA("TextLabel") then
                        stock = stockTxt.Text
                    end
                    
                    local cost = ""
                    local costTxt = itemFrame:FindFirstChild("Cost_Text")
                    if costTxt and costTxt:IsA("TextLabel") then
                        cost = costTxt.Text
                    else
                        -- Cari TextLabel lain di dalam frame yang berisi angka (harga)
                        for _, child in ipairs(itemFrame:GetChildren()) do
                            if child:IsA("TextLabel") and child.Name ~= "Seed_Text" and child.Name ~= "Rarity_Text" and child.Name ~= "Stock_Text" and child.Name ~= "Timer" then
                                local txt = child.Text
                                if tonumber(txt) or txt == "NO STOCK" or txt == "FREE" then
                                    cost = txt
                                    break
                                end
                            end
                        end
                    end
                    
                    local timer = ""
                    local timerTxt = itemFrame:FindFirstChild("Timer")
                    if timerTxt and timerTxt:IsA("TextLabel") then
                        timer = timerTxt.Text
                        restockTimer = timer -- Ambil salah satu timer barang sebagai info restock toko global
                    end
                    
                    -- Bersihkan nama barang (misal "Carrot Seed" -> "Carrot")
                    local cleanName = name:gsub("%s*[Ss]eeds?$", ""):gsub("%s*[Bb]enih$", ""):gsub("%s*[Pp]ack$", "")
                    
                    -- Deteksi Emoji kustom berdasarkan nama barang
                    local emojiName = cleanName:lower():gsub("%s+", "_"):gsub("'", ""):gsub("[^%w_]", "")
                    local emoji = ":" .. emojiName .. ":"
                    
                    -- Ekstrak kuantitas (misal "x16" dari "x16 in Stock")
                    local cleanQty = stock:match("x%d+") or stock or "x1"
                    
                    -- Susun format info item ringkas & cantik
                    local itemInfo = string.format("%s %s %s\n", emoji, cleanName, cleanQty)
                    
                    -- Kelompokkan Benih (Seeds) vs Peralatan (Gears)
                    if name:lower():find("seed") or name:lower():find("benih") or name:lower():find("pack") then
                        table.insert(seedsList, itemInfo)
                    else
                        table.insert(gearsList, itemInfo)
                    end
                end
            end
        end
    end
    
    local seedsText = table.concat(seedsList)
    local gearsText = table.concat(gearsList)
    
    -- Jika toko tertutup, kirim peringatan alih-alih pesan kosong
    if not (seedShop and seedShop.Enabled) then
        seedsText = "⚠️ *Menu Toko (SeedShop) sedang tertutup di game Anda. Silakan buka tokonya untuk memperbarui stok!*"
        gearsText = "⚠️ *Menu Toko (SeedShop) sedang tertutup di game Anda. Silakan buka tokonya untuk memperbarui stok!*"
    end

    -- Hitung Waktu Restock Berikutnya
    local nextRestockText = "🔄 Restock berikutnya dalam: **" .. restockTimer .. "**"
    if restockTimer == "N/A" then
        local now = os.time()
        local nextRestockTime = 300 - (now % 300)
        local mins = math.floor(nextRestockTime / 60)
        local secs = nextRestockTime % 60
        nextRestockText = string.format("🔄 Restock berikutnya dalam: **%d menit %d detik**", mins, secs)
    end

    -- 1. KIRIM INFO SEEDS
    sendToWebhook(SEED_WEBHOOK_URL, "🌱 UPDATE STOK BENIH (SEEDS) - GAG2", "Stok benih aktif dari server game:", {
        { name = "Benih yang Tersedia", value = seedsText, inline = false }
    }, 3066993) -- Green
    
    -- 2. KIRIM INFO GEARS
    sendToWebhook(GEAR_WEBHOOK_URL, "🛠️ UPDATE STOK PERALATAN (GEARS) - GAG2", "Stok peralatan aktif dari server game:", {
        { name = "Peralatan yang Tersedia", value = gearsText, inline = false }
    }, 15105570) -- Orange/Bronze
    
    -- 3. KIRIM INFO PREDIKSI (Selalu dikirim)
    sendToWebhook(PRED_WEBHOOK_URL, "🔮 PREDIKSI ROTASI TOKO - GAG2", "Informasi estimasi restock server global:", {
        { name = "Waktu Restock", value = nextRestockText, inline = false }
    }, 10181046) -- Purple

    -- 4. KIRIM INFO STATUS CUACA (Selalu dikirim)
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
