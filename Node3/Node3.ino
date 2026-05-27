#include <SPI.h>
#include <LoRa.h>
#include "mbedtls/sha256.h"
#include <time.h>

#define SS 5
#define RST 14
#define DIO0 26

#define SECRET_KEY "secret_key"

#define RAIN_MIN 0
#define RAIN_MAX 100

#define SOIL_MIN 0
#define SOIL_MAX 100

#define TILT_MIN 0
#define TILT_MAX 45

#define VIBRATION_MIN 0
#define VIBRATION_MAX 50

String sha256(String input) {
  byte hash[32];
  mbedtls_sha256((const unsigned char*)input.c_str(), input.length(), hash, 0);

  String result = "";
  for (int i = 0; i < 32; i++) {
    char str[3];
    sprintf(str, "%02x", hash[i]);
    result += str;
  }
  return result;
}

// Sinh số ngẫu nhiên trong khoảng [min, max]
int randomValue(int min, int max) {
  return random(min, max + 1);
}

// Sinh số thực ngẫu nhiên trong khoảng [min, max]
float randomFloatValue(float min, float max) {
  return min + (max - min) * (random(0, 10000) / 10000.0);
}

void setup() {
  Serial.begin(115200);
  
  // Khởi tạo seed cho random dựa trên thời gian
  randomSeed(millis());

  // Tạo LoRa
  LoRa.setPins(SS, RST, DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa init failed!");
    while (1)
      ;
  }

  Serial.println("LoRa Node Simulator ready");
  Serial.println("Simulating sensor data...");
}

void loop() {
  // Sinh dữ liệu ngẫu nhiên cho các cảm biến
  int rainPercent = randomValue(RAIN_MIN, RAIN_MAX);
  int soilPercent = randomValue(SOIL_MIN, SOIL_MAX);
  float tilt = randomFloatValue(TILT_MIN, TILT_MAX);
  int vibrationCount = randomValue(VIBRATION_MIN, VIBRATION_MAX);

  // Thêm một số biến động để dữ liệu thực tế hơn
  if (rainPercent > 60) {
    soilPercent = min(100, soilPercent + randomValue(5, 20));
  }

  String nodeID = "NODE1";

  String data = nodeID + "|" + String(rainPercent) + "|" + String(soilPercent) + "|" + String(tilt, 2) + "|" + String(vibrationCount);

  String signature = sha256(data + SECRET_KEY);

  String packet = data + "|" + signature;

  Serial.println("=== SIMULATION DATA ===");
  Serial.printf("Timestamp: %lu ms\n", millis());
  Serial.printf("Rain: %d%%\n", rainPercent);
  Serial.printf("Soil Moisture: %d%%\n", soilPercent);
  Serial.printf("Tilt Angle: %.2f°\n", tilt);
  Serial.printf("Vibration Count: %d\n", vibrationCount);
  Serial.println("Sending: " + packet);
  Serial.println();

  LoRa.beginPacket();
  LoRa.print(packet);
  LoRa.endPacket();

  delay(3000);
}
