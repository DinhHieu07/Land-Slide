#include <SPI.h>
#include <LoRa.h>
#include <Adafruit_MPU6050.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include "mbedtls/sha256.h"

#define RAIN_SENSOR 34
#define MOISTURE_SENSOR 35
#define VIBRATION_SENSOR 27

#define SS 5
#define RST 14
#define DIO0 26

#define RAIN_DRY 4095
#define RAIN_WET 750

#define SOIL_DRY 2300
#define SOIL_WET 700

#define SECRET_KEY "secret_key"

Adafruit_MPU6050 mpu;

String sha256(String input) {
  byte hash[32];
  mbedtls_sha256((const unsigned char*)input.c_str(), input.length(), hash, 0);  // 0 là sha256, 1 là sha224

  String result = "";
  for (int i = 0; i < 32; i++) {
    char str[3];
    sprintf(str, "%02x", hash[i]);
    result += str;
  }
  return result;
}

void setup() {
  Serial.begin(115200);

  pinMode(VIBRATION_SENSOR, INPUT);

  Wire.begin(21, 22);

  if (!mpu.begin()) {
    Serial.println("MPU6050 not found");
    while (1)
      ;
  }

  Serial.println("MPU6050 ready");

  // Tạo LoRa
  LoRa.setPins(SS, RST, DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa init failed!");
    while (1)
      ;
  }

  Serial.println("LoRa Node ready");
}

void loop() {
  int rain = analogRead(RAIN_SENSOR);
  int moisture = analogRead(MOISTURE_SENSOR);

  int vibrationCount = 0;
  unsigned long startTime = millis();
  unsigned long lastTrigger = 0;

  while (millis() - startTime < 2000) {
    int val = digitalRead(VIBRATION_SENSOR);

    if (val == 1 && millis() - lastTrigger > 100) {
      vibrationCount++;
      lastTrigger = millis();
    }
  }

  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  int rainPercent = map(rain, RAIN_DRY, RAIN_WET, 0, 100);
  rainPercent = constrain(rainPercent, 0, 100);

  int soilPercent = map(moisture, SOIL_DRY, SOIL_WET, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  float denom = sqrt(pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2));
  float tilt = 0;

  if (denom != 0) {
    tilt = abs(atan(a.acceleration.x / denom) * 180 / PI);
  }

  String nodeID = "NODE1";

  String data = nodeID + "|" + String(rainPercent) + "|" + String(soilPercent) + "|" + String(tilt) + "|" + String(vibrationCount);

  String signature = sha256(data + SECRET_KEY);  // tạo signature

  String packet = data + "|" + signature;  // packet cuối cùng

  Serial.printf("Raw Soil: %d\n", moisture);
  Serial.printf("Raw Rain: %d\n", rain);
  Serial.println("Sending: " + packet);

  // Gửi LoRa
  LoRa.beginPacket();
  LoRa.print(packet);
  LoRa.endPacket();

  delay(3000);
}