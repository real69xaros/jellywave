#!/bin/bash
set -e

echo "Starting Android Headless Build Process..."

# 1. Download and Extract OpenJDK 21
if [ ! -d "/home/xaros/jdk-21.0.2" ]; then
    echo "Downloading OpenJDK 21..."
    wget -q -O /home/xaros/openjdk-21.tar.gz https://download.java.net/java/GA/jdk21.0.2/f2283984656d49d69e91c558474d150a/13/GPL/openjdk-21.0.2_linux-x64_bin.tar.gz
    echo "Extracting OpenJDK 21..."
    tar xf /home/xaros/openjdk-21.tar.gz -C /home/xaros/
    rm -f /home/xaros/openjdk-21.tar.gz
fi

export JAVA_HOME=/home/xaros/jdk-21.0.2
export PATH=$JAVA_HOME/bin:$PATH

echo "Java Version Check:"
java -version 2>&1

# 2. Download and Extract Android SDK Command Line Tools
if [ ! -d "/home/xaros/android-sdk/cmdline-tools/latest" ]; then
    echo "Downloading Android SDK Command Line Tools..."
    wget -q -O /home/xaros/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
    mkdir -p /home/xaros/android-sdk/cmdline-tools
    echo "Extracting SDK Tools..."
    unzip -q /home/xaros/cmdline-tools.zip -d /home/xaros/android-sdk/cmdline-tools
    mv /home/xaros/android-sdk/cmdline-tools/cmdline-tools /home/xaros/android-sdk/cmdline-tools/latest
    rm -f /home/xaros/cmdline-tools.zip
fi

export ANDROID_HOME=/home/xaros/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

# 3. Accept Licenses and Install Required SDKs
echo "Accepting Android SDK licenses and installing platforms..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" > /dev/null 2>&1

# 4. Build the Android Project
cd "/home/xaros/Documents/music app v2"

echo "Syncing Capacitor plugins and config..."
npx cap sync android

echo "Running Gradle assembleDebug..."
cd android
./gradlew assembleDebug

# 5. Move APK to Releases folder
echo "Moving APK to /homepage/releases/"
mkdir -p ../homepage/releases
cp app/build/outputs/apk/debug/app-debug.apk ../homepage/releases/JellyWave-Android.apk

echo "Done! APK successfully built and moved to homepage/releases/JellyWave-Android.apk!"
