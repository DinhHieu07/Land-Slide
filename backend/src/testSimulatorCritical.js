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

console.log(`🚨 SIMULATOR CẢNH BÁO NGUY HIỂM - Device: ${DEVICE_ID}`);
console.log(`Đang kết nối tới MQTT broker...`);
const client = mqtt.connect(options);


client.on('connect', () => {
    console.log('✅ Đã kết nối MQTT broker thành công!');
    console.log('🚨 Gửi dữ liệu cảnh báo mức NGUY HIỂM (Critical) - 1 lần duy nhất...\n');
    
    const timestamp = new Date().toISOString();

    // Ngưỡng max: 2.5g, gửi 4.5g để tạo CRITICAL (>50% vượt ngưỡng)
    const vibration = 4.5;
    console.log(`🚨 VIB: ${vibration}g (ngưỡng: 2.5g) - VƯỢT ${((vibration/2.5 - 1) * 100).toFixed(1)}% - CẢNH BÁO NGUY HIỂM!`);

    const rainValue = 150;
    console.log(`✅ RAIN: ${rainValue}mm (ngưỡng: 300mm) - AN TOÀN`);

    const soilValue = 50;
    console.log(`✅ SOIL: ${soilValue}% (ngưỡng: 10-90%) - AN TOÀN`);

    const tiltValue = 8;
    console.log(`✅ TILT: ${tiltValue}° (ngưỡng: 15°) - AN TOÀN`);

    const slopeValue = 25;
    console.log(`✅ SLOPE: ${slopeValue}° (ngưỡng: 40°) - AN TOÀN`);

    const payload = JSON.stringify({
        device_id: DEVICE_ID,
        timestamp: timestamp,
        readings: [
            { sensor_id: "VIB", value: vibration },
            { sensor_id: "RAIN", value: rainValue },
            { sensor_id: "SOIL", value: soilValue },
            { sensor_id: "TILT", value: tiltValue },
            { sensor_id: "SLOPE", value: slopeValue }
        ]
    });

    const topic = process.env.MQTT_TOPIC;
    client.publish(topic, payload, (err) => {
        if (err) {
            console.error('❌ Lỗi khi gửi dữ liệu:', err);
        } else {
            console.log(`\n✅ Đã gửi dữ liệu cảnh báo NGUY HIỂM (${payload.length} bytes)`);
            console.log('💡 Kiểm tra Dashboard và trang Alerts để xem cảnh báo CRITICAL được tạo.');
        }
        setTimeout(() => {
            client.end();
            console.log('🔌 Đã đóng kết nối MQTT.');
            process.exit(0);
        }, 1000);
    });
});

client.on('error', (err) => {
    console.error('❌ Lỗi kết nối MQTT:', err);
    process.exit(1);
});

client.on('close', () => {
    console.log('🔌 MQTT connection đã đóng');
});

client.on('reconnect', () => {
    console.log('🔄 Đang kết nối lại MQTT...');
});