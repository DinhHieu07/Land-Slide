require('dotenv').config();

const mqtt = require('mqtt');

const options = {
    host: process.env.MQTT_HOST,
    port: parseInt(process.env.MQTT_PORT),
    protocol: process.env.MQTT_PROTOCOL,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    rejectUnauthorized: true,
};

const DEVICE_ID = process.env.SIMULATOR_DEVICE_ID || 'HG-GW001';

console.log(`Đang kết nối tới HiveMQ cho device: ${DEVICE_ID}...`);
const client = mqtt.connect(options);

client.on('connect', () => {
    console.log('Kết nối thành công! Bắt đầu gửi dữ liệu giả lập...');

    setInterval(() => {
        const timestamp = new Date().toISOString();
        
        // Cảm biến rung (VIB) - vibration_g: 0-2.5g (ngưỡng max: 2.5)
        let vibration = (Math.random() * 0.5).toFixed(2);
        if (Math.random() > 0.9) {
            vibration = (Math.random() * (3.5 - 2.5) + 2.5).toFixed(2);
            console.log("⚠️ CẢNH BÁO: Phát hiện rung chấn mạnh!");
        }

        // Cảm biến lượng mưa (RAIN) - rainfall_24h: 0-300mm (ngưỡng max: 300)
        const rainfall = (Math.random() * 250).toFixed(2);
        let rainValue = parseFloat(rainfall);
        if (Math.random() > 0.95) {
            rainValue = (Math.random() * (350 - 300) + 300).toFixed(2);
            console.log("⚠️ CẢNH BÁO: Lượng mưa vượt ngưỡng!");
        }

        // Cảm biến độ ẩm đất (SOIL) - soil_moisture: 10-90% (ngưỡng min: 10, max: 90)
        const soilMoisture = (Math.random() * (80 - 40) + 40).toFixed(2);
        let soilValue = parseFloat(soilMoisture);
        if (Math.random() > 0.95) {
            soilValue = (Math.random() * (95 - 90) + 90).toFixed(2);
            console.log("⚠️ CẢNH BÁO: Độ ẩm đất vượt ngưỡng!");
        }

        // Cảm biến nghiêng (TILT) - tilt_deg: 0-15° (ngưỡng max: 15)
        const tilt = (Math.random() * 10).toFixed(2);
        let tiltValue = parseFloat(tilt);
        if (Math.random() > 0.95) {
            tiltValue = (Math.random() * (18 - 15) + 15).toFixed(2);
            console.log("⚠️ CẢNH BÁO: Độ nghiêng vượt ngưỡng!");
        }

        // Cảm biến độ dốc (SLOPE) - slope_deg: 0-40° (ngưỡng max: 40)
        const slope = (Math.random() * 30).toFixed(2);
        let slopeValue = parseFloat(slope);
        if (Math.random() > 0.95) {
            slopeValue = (Math.random() * (45 - 40) + 40).toFixed(2);
            console.log("⚠️ CẢNH BÁO: Độ dốc vượt ngưỡng!");
        }

        const payload = JSON.stringify({
            device_id: DEVICE_ID,
            timestamp: timestamp,
            readings: [
                { sensor_id: "VIB", value: parseFloat(vibration) },
                { sensor_id: "RAIN", value: rainValue },
                { sensor_id: "SOIL", value: soilValue },
                { sensor_id: "TILT", value: tiltValue },
                { sensor_id: "SLOPE", value: slopeValue }
            ]
        });

        const topic = process.env.MQTT_TOPIC;
        client.publish(topic, payload);
        console.log(` [${DEVICE_ID}] Đã gửi ${payload.length} bytes`);

    }, 5000);
});

client.on('error', (err) => {
    console.error('Lỗi kết nối MQTT:', err);
});

client.on('close', () => {
    console.log(' MQTT connection đã đóng');
});

client.on('reconnect', () => {
    console.log('Đang kết nối lại MQTT...');
});