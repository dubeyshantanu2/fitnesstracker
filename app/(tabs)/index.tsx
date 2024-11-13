import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Button,
  Alert,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

// Type for location coordinates
import type { LocationObjectCoords } from "expo-location";

const screenWidth = Dimensions.get("window").width;

export default function App() {
  const [tracking, setTracking] = useState(false);
  const [startLocation, setStartLocation] =
    useState<LocationObjectCoords | null>(null);
  const [endLocation, setEndLocation] = useState<LocationObjectCoords | null>(
    null
  );
  const [distance, setDistance] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [hourlyStepData, setHourlyStepData] = useState(Array(24).fill(0));
  const lastStepTime = useRef(Date.now());
  const prevMagnitude = useRef(0);

  const getCurrentLocation = async (): Promise<LocationObjectCoords | null> => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission to access location was denied");
      return null;
    }
    const location = await Location.getCurrentPositionAsync({});
    return location.coords;
  };

  const startTracking = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setStartLocation(location);
      setTracking(true);
      Alert.alert("Tracking started");
    }
  };

  const stopTracking = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setEndLocation(location);
      if (startLocation) {
        const calculatedDistance = calculateDistance(startLocation, location);
        setTracking(false);
        setDistance(calculatedDistance);
        Alert.alert(
          "Tracking stopped",
          `Distance traveled: ${calculatedDistance.toFixed(
            2
          )} km, Steps taken: ${stepCount}`
        );
      } else {
        Alert.alert("Error", "Start location not set");
      }
    }
  };

  const calculateDistance = (
    start: LocationObjectCoords,
    end: LocationObjectCoords
  ): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const lat1 = toRad(start.latitude);
    const lon1 = toRad(start.longitude);
    const lat2 = toRad(end.latitude);
    const lon2 = toRad(end.longitude);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const earthRadius = 6371;

    return earthRadius * c;
  };

  useEffect(() => {
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (tracking) {
        detectStep({ x, y, z });
      }
    });

    return () => subscription.remove();
  }, [tracking]);

  const detectStep = ({ x, y, z }: { x: number; y: number; z: number }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const timeNow = Date.now();
    const threshold = 1.2; // Adjust for step sensitivity
    const stepInterval = 300; // Minimum interval between steps in milliseconds

    if (magnitude > threshold && prevMagnitude.current <= threshold) {
      if (timeNow - lastStepTime.current > stepInterval) {
        setStepCount((prevStepCount) => prevStepCount + 1);
        updateHourlyStepData();
        lastStepTime.current = timeNow;
      }
    }

    prevMagnitude.current = magnitude;
  };

  const updateHourlyStepData = () => {
    const currentHour = new Date().getHours();
    setHourlyStepData((prevData) => {
      const updatedData = [...prevData];
      updatedData[currentHour] += 1;
      return updatedData;
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Distance Tracker</Text>
      <Text>Total Distance: {distance.toFixed(2)} km</Text>
      <Text>Total Steps: {stepCount}</Text>
      {tracking ? (
        <Button title="Stop" onPress={stopTracking} />
      ) : (
        <Button title="Start" onPress={startTracking} />
      )}
      <Text style={styles.chartHeader}>Hourly Step Count</Text>
      <LineChart
        data={{
          labels: Array.from({ length: 24 }, (_, i) => i.toString()),
          datasets: [
            {
              data: hourlyStepData,
              color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
              strokeWidth: 2,
            },
          ],
        }}
        width={screenWidth - 16}
        height={250}
        chartConfig={{
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          strokeWidth: 2,
          decimalPlaces: 0,
        }}
        bezier
        style={styles.chart}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingTop: 50,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  chartHeader: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 20,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});
