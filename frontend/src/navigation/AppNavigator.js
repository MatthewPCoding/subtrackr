import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text } from 'react-native';
import { colors, radius } from '../theme';

import DashboardScreen from '../screens/DashboardScreen';
import SubscriptionsScreen from '../screens/SubscriptionsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import AlertsScreen from '../screens/AlertsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SubscriptionDetailScreen from '../screens/SubscriptionDetailScreen';
import EmailScanScreen from '../screens/EmailScanScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeIcon = ({ color }) => (
  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {[0,1,2,3].map(i => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 2, borderWidth: 1.5, borderColor: color }} />
      ))}
    </View>
  </View>
);

const ListIcon = ({ color }) => (
  <View style={{ width: 22, height: 22, justifyContent: 'center', gap: 4 }}>
    {[0,1,2].map(i => (
      <View key={i} style={{ height: 1.5, backgroundColor: color, borderRadius: 2, width: i === 0 ? 22 : i === 1 ? 16 : 12 }} />
    ))}
  </View>
);

const ChartIcon = ({ color }) => (
  <View style={{ width: 22, height: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
    {[8, 14, 10, 18].map((h, i) => (
      <View key={i} style={{ flex: 1, height: h, backgroundColor: color, borderRadius: 2 }} />
    ))}
  </View>
);

const BellIcon = ({ color }) => (
  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 14, height: 12, borderWidth: 1.5, borderColor: color, borderRadius: 8, borderBottomWidth: 0 }} />
    <View style={{ width: 1.5, height: 3, backgroundColor: color, marginTop: -1 }} />
    <View style={{ width: 6, height: 1.5, backgroundColor: color, borderRadius: 2, marginTop: 1 }} />
  </View>
);

const GearIcon = ({ color }) => (
  <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 5, height: 5, borderRadius: 2.5, borderWidth: 1.5, borderColor: color }} />
    </View>
  </View>
);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, marginTop: 2 },
        tabBarIcon: ({ color }) => {
          if (route.name === 'Home') return <HomeIcon color={color} />;
          if (route.name === 'Subscriptions') return <ListIcon color={color} />;
          if (route.name === 'Analytics') return <ChartIcon color={color} />;
          if (route.name === 'Alerts') return <BellIcon color={color} />;
          if (route.name === 'Settings') return <GearIcon color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetailScreen} />
      <Stack.Screen name="EmailScan" component={EmailScanScreen} />
    </Stack.Navigator>
  );
}
