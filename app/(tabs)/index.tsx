import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Text, Button, Alert, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText"; // Custom themed text component
import * as Location from "expo-location"; // Module for location services
import { Accelerometer } from "expo-sensors"; // Module for accelerometer data
import { LineChart } from "react-native-chart-kit"; // Chart library for data visualization
import { Dimensions } from "react-native"; // Used for getting device screen dimensions

// Type for location coordinates
import type { LocationObjectCoords } from "expo-location";

// Get the screen width for the chart's width
const screenWidth = Dimensions.get("window").width;

export default function App() {
  // State variables
  const [tracking, setTracking] = useState(false); // Whether tracking is active
  const [startLocation, setStartLocation] =
    useState<LocationObjectCoords | null>(null); // Starting location
  const [_, setEndLocation] = useState<LocationObjectCoords | null>(null); // Ending location
  const [distance, setDistance] = useState(0); // Total distance traveled
  const [stepCount, setStepCount] = useState(0); // Total step count
  const [hourlyStepData, setHourlyStepData] = useState(Array(24).fill(0)); // Step count for each hour
  const lastStepTime = useRef(Date.now()); // Time of the last detected step
  const prevMagnitude = useRef(0); // Previous magnitude of accelerometer data

  // Function to get the current location
  const getCurrentLocation = async (): Promise<LocationObjectCoords | null> => {
    // Request permission for location services
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission to access location was denied");
      return null;
    }
    // Get the current location
    const location = await Location.getCurrentPositionAsync({});
    return location.coords;
  };

  // Function to start tracking
  const startTracking = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setStartLocation(location); // Set the start location
      setTracking(true); // Enable tracking
      Alert.alert("Tracking started");
    }
  };

  // Function to stop tracking
  const stopTracking = async () => {
    const location = await getCurrentLocation();
    if (location) {
      setEndLocation(location); // Set the end location
      if (startLocation) {
        // Calculate the distance traveled
        const calculatedDistance = calculateDistance(startLocation, location);
        setTracking(false); // Disable tracking
        setDistance(calculatedDistance); // Update distance state
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

  // Function to calculate distance between two coordinates using the Haversine formula
  const calculateDistance = (
    start: LocationObjectCoords,
    end: LocationObjectCoords
  ): number => {
    const toRad = (value: number) => (value * Math.PI) / 180; // Convert degrees to radians
    const lat1 = toRad(start.latitude);
    const lon1 = toRad(start.longitude);
    const lat2 = toRad(end.latitude);
    const lon2 = toRad(end.longitude);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // Angular distance in radians
    const earthRadius = 6371; // Radius of the Earth in kilometers

    return earthRadius * c; // Return the distance in kilometers
  };

  // useEffect hook to set up accelerometer listener
  useEffect(() => {
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (tracking) {
        detectStep({ x, y, z }); // Call step detection function when tracking is enabled
      }
    });

    return () => subscription.remove(); // Clean up listener on component unmount
  }, [tracking]);

  // Function to detect a step based on accelerometer data
  const detectStep = ({ x, y, z }: { x: number; y: number; z: number }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z); // Calculate vector magnitude
    const timeNow = Date.now(); // Current timestamp
    const threshold = 1.2; // Magnitude threshold for step detection
    const stepInterval = 500; // Minimum interval between steps in milliseconds

    // Check if magnitude crosses the threshold and if enough time has passed since the last step
    if (magnitude > threshold && prevMagnitude.current <= threshold) {
      if (timeNow - lastStepTime.current > stepInterval) {
        setStepCount((prevStepCount) => prevStepCount + 1); // Increment step count
        updateHourlyStepData(); // Update hourly step data
        lastStepTime.current = timeNow; // Update the last step time
      }
    }

    prevMagnitude.current = magnitude; // Update previous magnitude
  };

  // Function to update hourly step data
  const updateHourlyStepData = () => {
    const currentHour = new Date().getHours(); // Get the current hour
    setHourlyStepData((prevData) => {
      const updatedData = [...prevData]; // Copy the previous data
      updatedData[currentHour] += 1; // Increment the step count for the current hour
      return updatedData; // Return updated data
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText style={styles.header}>Distance Tracker</ThemedText>
      <ThemedText>Total Distance: {distance.toFixed(2)} km</ThemedText>
      <ThemedText>Total Steps: {stepCount}</ThemedText>
      {tracking ? (
        <Button title="Stop" onPress={stopTracking} />
      ) : (
        <Button title="Start" onPress={startTracking} />
      )}
      <ThemedText style={styles.chartHeader}>Hourly Step Count</ThemedText>
      <LineChart
        data={{
          labels: Array.from({ length: 24 }, (_, i) => i.toString()), // Hour labels (0 to 23)
          datasets: [
            {
              data: hourlyStepData, // Step data for each hour
              color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`, // Line color
              strokeWidth: 2, // Line thickness
            },
          ],
        }}
        width={screenWidth} // Chart width
        height={250} // Chart height
        chartConfig={{
          backgroundGradientFrom: "#fff", // Background color
          backgroundGradientTo: "#fff", // Background color
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Text color
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Label color
          strokeWidth: 2, // Line thickness
          decimalPlaces: 0, // No decimal places
        }}
        bezier // Smooth line chart
        style={styles.chart} // Chart styling
      />
    </ScrollView>
  );
}

// Styles for the app
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
