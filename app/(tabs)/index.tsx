import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, View, Button, Alert } from "react-native";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";

const BACKGROUND_STEP_TASK = "BACKGROUND_STEP_TASK";

TaskManager.defineTask(BACKGROUND_STEP_TASK, async () => {
  try {
    const stepCountData = await new Promise((resolve) => {
      let stepCount = 0;

      const subscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const threshold = 1.2; // Adjust sensitivity
        if (magnitude > threshold) {
          stepCount++;
        }
      });

      setTimeout(() => {
        subscription.remove();
        resolve(stepCount);
      }, 10000); // Simulate 10 seconds of data collection
    });

    console.log(`Step count during background task: ${stepCountData}`);
    return BackgroundFetch.Result.NewData;
  } catch (error) {
    console.error(error);
    return BackgroundFetch.Result.Failed;
  }
});

// Register background task
BackgroundFetch.registerTaskAsync(BACKGROUND_STEP_TASK, {
  minimumInterval: 15, // Fetch interval in minutes
  stopOnTerminate: false,
  startOnBoot: true,
});

export default function App() {
  const [tracking, setTracking] = useState(false);
  const [startLocation, setStartLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [endLocation, setEndLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [distance, setDistance] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const lastStepTime = useRef(Date.now());
  const prevMagnitude = useRef(0);

  const getCurrentLocation =
    async (): Promise<Location.LocationObjectCoords | null> => {
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
    start: Location.LocationObjectCoords,
    end: Location.LocationObjectCoords
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
        lastStepTime.current = timeNow;
      }
    }

    prevMagnitude.current = magnitude;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Distance Tracker</Text>
      <Text>Total Distance: {distance.toFixed(2)} km</Text>
      <Text>Total Steps: {stepCount}</Text>
      {tracking ? (
        <Button title="Stop" onPress={stopTracking} />
      ) : (
        <Button title="Start" onPress={startTracking} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});
