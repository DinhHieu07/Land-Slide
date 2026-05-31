#include <SPI.h>
#include <LoRa.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include "mbedtls/sha256.h"

WiFiClientSecure espClient;

PubSubClient client(espClient);

#define SS 5
#define RST 14
#define DIO0 26

#define SECRET_KEY "secret_key"

unsigned long rainWarningStart = 0;
unsigned long rainDangerStart = 0;
const char* deviceID = "HG-GW001";

// Node disconnect tracking
#define NODE_DISCONNECT_TIMEOUT 1800000 // 30 phút = 30 * 60 * 1000 ms
#define MAX_NODES 20

struct NodeStatus {
  String nodeID;
  unsigned long lastHeartbeat;
  bool isConnected;
};

NodeStatus nodeStatuses[MAX_NODES];
int nodeCount = 0;

const char* ssid = "iPhone";
const char* password = "30072004";

const char* mqtt_server = "9ee8db347fe54dca90deec51488915e5.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "landslide_admin";
const char* mqtt_pass = "Landslide_password_1";

// Hàm tính điểm rủi ro từng thành phần
int getLevel(int value, int low, int high) {
  if (value < low) return 0;
  else if (value < high) return 1;
  else return 2;
}

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

// Hàm cập nhật trạng thái Node
void updateNodeHeartbeat(String nodeID) {
  for (int i = 0; i < nodeCount; i++) {
    if (nodeStatuses[i].nodeID == nodeID) {
      nodeStatuses[i].lastHeartbeat = millis();
      if (!nodeStatuses[i].isConnected) {
        nodeStatuses[i].isConnected = true;
        Serial.printf("Node %s: RECONNECTED\n", nodeID.c_str());
      }
      return;
    }
  }
  
  // Node mới, thêm vào danh sách
  if (nodeCount < MAX_NODES) {
    nodeStatuses[nodeCount].nodeID = nodeID;
    nodeStatuses[nodeCount].lastHeartbeat = millis();
    nodeStatuses[nodeCount].isConnected = true;
    nodeCount++;
    Serial.printf("Node %s: REGISTERED\n", nodeID.c_str());
  }
}

// Hàm kiểm tra Node nào đã disconnect
void checkNodeDisconnect() {
  unsigned long currentTime = millis();
  
  for (int i = 0; i < nodeCount; i++) {
    if (nodeStatuses[i].isConnected) {
      // Nếu đã qua 30 phút không nhận dữ liệu
      if (currentTime - nodeStatuses[i].lastHeartbeat >= NODE_DISCONNECT_TIMEOUT) {
        nodeStatuses[i].isConnected = false;
        Serial.printf("Node %s: DISCONNECTED (timeout)\n", nodeStatuses[i].nodeID.c_str());
        
        // Gửi thông báo disconnect
        sendDisconnectNotification(nodeStatuses[i].nodeID);
      }
    }
  }
}

// Hàm gửi thông báo disconnect qua MQTT
void sendDisconnectNotification(String nodeID) {
  String topic = "landslide/" + String(deviceID) + "/data";
  
  String payload = "{";
  payload += "\"device\":\"" + String(deviceID) + "\",";
  payload += "\"node\":\"" + nodeID + "\",";
  payload += "\"status\":\"disconnected\",";
  payload += "\"timestamp\":" + String(millis());
  payload += "}";
  
  client.publish(topic.c_str(), payload.c_str());
  
  Serial.println("MQTT Disconnect Alert: " + payload);
}

void setup_wifi() {
  delay(10);
  Serial.println("Connecting WiFi...");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting MQTT...");

    if (client.connect("ESP32_Gateway", mqtt_user, mqtt_pass)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  LoRa.setPins(SS, RST, DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("LoRa init failed!");
    while (1)
      ;
  }
  setup_wifi();
  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);

  Serial.println("LoRa Gateway ready");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Kiểm tra Node nào đã disconnect
  checkNodeDisconnect();

  int packetSize = LoRa.parsePacket();

  if (packetSize) {
    String received = "";

    while (LoRa.available()) {
      received += (char)LoRa.read();
    }

    Serial.println("\n--- New Packet ---");
    Serial.println("Raw Data: " + received);
    Serial.print("RSSI: ");
    Serial.println(LoRa.packetRssi());

    char payload[received.length() + 1];
    received.toCharArray(payload, sizeof(payload));

    // Bóc tách dữ liệu
    char* nodeIDStr = strtok(payload, "|");
    char* rainStr = strtok(NULL, "|");
    char* soilStr = strtok(NULL, "|");
    char* tiltStr = strtok(NULL, "|");
    char* vibStr = strtok(NULL, "|");
    char* sigStr = strtok(NULL, "|");

    if (nodeIDStr && rainStr && soilStr && tiltStr && vibStr && sigStr) {
      String nodeID = String(nodeIDStr);
            
      // Cập nhật heartbeat cho Node này
      updateNodeHeartbeat(nodeID);
      
      int rainPercent = atoi(rainStr);
      int soilPercent = atoi(soilStr);
      float tilt = atof(tiltStr);
      int vibrationCount = atoi(vibStr);
      String receivedSig = String(sigStr);

      int rainLevel = getLevel(rainPercent, 40, 80);
      int soilLevel = getLevel(soilPercent, 20, 80);
      int tiltLevel = getLevel(abs(tilt), 5, 10);

      // Verify signature
      String rawData = nodeID + "|" + String(rainPercent) + "|" + String(soilPercent) + "|" + String(tilt, 2) + "|" + String(vibrationCount);
      String expectedSig = sha256(rawData + SECRET_KEY);
      if (expectedSig != receivedSig) {
        Serial.println("SIGNATURE INVALID");
        return;
      }

      // --- Theo dõi mưa ---
      if (rainLevel == 1) {
        if (rainWarningStart == 0) rainWarningStart = millis();
      } else {
        rainWarningStart = 0;
      }

      if (rainLevel == 2) {
        if (rainDangerStart == 0) rainDangerStart = millis();
      } else {
        rainDangerStart = 0;
      }

      // --- Check thời gian ---
      bool rainWarningConfirmed = false;
      bool rainDangerConfirmed = false;

      if (rainWarningStart != 0 && millis() - rainWarningStart >= 20000) {
        rainWarningConfirmed = true;
      }

      if (rainDangerStart != 0 && millis() - rainDangerStart >= 60000) {
        rainDangerConfirmed = true;
      }

      int vibLevel;
      if (vibrationCount < 10) vibLevel = 0;
      else if (vibrationCount <= 20) vibLevel = 1;
      else vibLevel = 2;

      int riskScore = rainLevel + soilLevel + tiltLevel + vibLevel;
      int alertLevel = 1;  // 1: Safe, 2: Warning, 3: Danger

      // -- Nguy hiểm --
      if (
        rainDangerConfirmed ||                 // mưa to kéo dài 60s
        (tiltLevel == 2 && soilLevel >= 1) ||  // nghiêng + đất ẩm
        (vibLevel == 2 && tiltLevel >= 1) ||   // rung mạnh + nghiêng
        (soilLevel == 2 && tiltLevel >= 1)     // đất bão hòa + nghiêng
      ) {
        alertLevel = 3;
      }
      // -- Cảnh báo --
      else if (
        rainWarningConfirmed ||                // mưa vừa kéo dài 20s
        (soilLevel == 2 && rainLevel >= 1) ||  // đất ướt + có mưa
        (rainLevel == 2 && soilLevel >= 1) ||  // mưa to nhưng chưa đủ 60s
        (tiltLevel == 2 && vibLevel >= 1) ||   // có chuyển động
        riskScore >= 3                         // fallback
      ) {
        alertLevel = 2;
      }
      // -- An toàn --
      else {
        alertLevel = 1;
      }

      Serial.printf("Node: %s | Cảnh báo mức: %d\n", nodeID.c_str(), alertLevel);
      String topic = "landslide/" + String(deviceID) + "/data";

      String mqttPayload = "{";
      mqttPayload += "\"device\":\"" + String(deviceID) + "\",";
      mqttPayload += "\"node\":\"" + nodeID + "\",";
      mqttPayload += "\"rain\":" + String(rainPercent) + ",";
      mqttPayload += "\"soil\":" + String(soilPercent) + ",";
      mqttPayload += "\"tilt\":" + String(tilt) + ",";
      mqttPayload += "\"vibration\":" + String(vibrationCount) + ",";
      mqttPayload += "\"alert\":" + String(alertLevel) + ",";
      mqttPayload += "\"status\":\"connected\"";
      mqttPayload += "}";

      client.publish(topic.c_str(), mqttPayload.c_str());

      Serial.println("MQTT Sent: " + mqttPayload);
    } else {
      Serial.println("Lỗi: Dữ liệu gửi đến bị sai định dạng!");
    }
    Serial.println("-------------------");
  }
}