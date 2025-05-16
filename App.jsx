import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, {Marker, PROVIDER_GOOGLE, Callout} from 'react-native-maps';
import {URLS} from './utils/urls';

const zoomFactor = 0.5;
const initialRegion = {
  latitude: 17.406498,
  longitude: 78.477244,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const App = () => {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState({
    formatted_address: '"Hyderabad, Telangana, India"',
    geometry: {
      location: {
        lat: 17.406498,
        lng: 78.477244,
      },
    },
    name: 'Hyderabad',
    place_id: 'ChIJx9Lr6tqZyzsRwvu6koO3k64',
  });
  const [searchHistory, setSearchHistory] = useState([]);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [region, setRegion] = useState(initialRegion);

  useEffect(() => {
    if (markerRef?.current) {
      markerRef.current.showCallout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerRef?.current]);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('searchHistory');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const saveSearchHistory = async newHistory => {
    try {
      await AsyncStorage.setItem('searchHistory', JSON.stringify(newHistory));
      setSearchHistory(newHistory);
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  const handleSearch = async text => {
    setSearchText(text);
    if (text.length > 1) {
      try {
        const response = await fetch(
          URLS.PLACE_TEXT_URL.replace('{TEXT}', text).replace(
            '{GOOGLE_PLACES_API_KEY}',
            URLS.GOOGLE_PLACES_API_KEY,
          ),
        );

        const data = await response.json();
        if (data.predictions) {
          setSearchResults(data.predictions);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error fetching search results:', error);
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handlePlaceSelect = async place => {
    setSearchText(place.description);
    setSearchResults([]);
    setSelectedPlace(null);
    try {
      const detailsResponse = await fetch(
        URLS.PLACE_URL.replace('{PLACE}', place.place_id).replace(
          '{GOOGLE_PLACES_API_KEY}',
          URLS.GOOGLE_PLACES_API_KEY,
        ),
      );
      const detailsData = await detailsResponse.json();
      if (detailsData.result) {
        setSelectedPlace(detailsData.result);
        // Save to history
        const newHistoryItem = {
          place_id: detailsData.result.place_id,
          name: detailsData.result.name,
          formatted_address: detailsData.result.formatted_address,
          geometry: detailsData.result.geometry,
        };
        const updatedHistory = [
          newHistoryItem,
          ...searchHistory.filter(
            item => item.place_id !== newHistoryItem.place_id,
          ),
        ];
        saveSearchHistory(updatedHistory.slice(0, 15)); // Limit history to 15 items
        // Move map to the selected location
        mapRef.current?.animateToRegion(
          {
            latitude: detailsData.result.geometry.location.lat,
            longitude: detailsData.result.geometry.location.lng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          1000,
        );
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  };

  const handleHistorySelect = historyItem => {
    setSelectedPlace(null);
    setTimeout(() => {
      setSelectedPlace(historyItem);
      handleOpenCallout();
    }, 200);
    // Move map to the selected location
    mapRef.current?.animateToRegion(
      {
        latitude: historyItem.geometry.location.lat,
        longitude: historyItem.geometry.location.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      1000,
    );
  };

  const handleRegionChange = region => {
    setRegion(region);
  };

  const handleOpenCallout = () => {
    if (markerRef.current) {
      console.log('markerRef.current', markerRef.current);
      markerRef.current.showCallout();
    }
  };
  const handleZoomIn = () => {
    const currentRegion = region;
    const newLatitudeDelta = currentRegion.latitudeDelta * zoomFactor;
    const newLongitudeDelta = currentRegion.longitudeDelta * zoomFactor;

    mapRef.current?.animateToRegion(
      {
        ...currentRegion,
        latitudeDelta: newLatitudeDelta,
        longitudeDelta: newLongitudeDelta,
      },
      200,
    );

    setRegion({
      ...currentRegion,
      latitudeDelta: newLatitudeDelta,
      longitudeDelta: newLongitudeDelta,
    });
  };

  const handleZoomOut = () => {
    const currentRegion = region;
    const newLatitudeDelta = currentRegion.latitudeDelta / zoomFactor;
    const newLongitudeDelta = currentRegion.longitudeDelta / zoomFactor;

    mapRef.current?.animateToRegion(
      {
        ...currentRegion,
        latitudeDelta: newLatitudeDelta,
        longitudeDelta: newLongitudeDelta,
      },
      200,
    );

    setRegion({
      ...currentRegion,
      latitudeDelta: newLatitudeDelta,
      longitudeDelta: newLongitudeDelta,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place"
          value={searchText}
          onChangeText={handleSearch}
        />
        {searchResults.length > 0 && (
          <FlatList
            style={styles.searchResultsList}
            data={searchResults}
            keyExtractor={item => item.place_id}
            renderItem={({item}) => (
              <TouchableOpacity
                onPress={() => handlePlaceSelect(item)}
                style={styles.searchResultItem}>
                <Text style={styles.searchItem}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation={true}
          initialRegion={initialRegion}
          onRegionChange={handleRegionChange}>
          {selectedPlace && (
            <Marker
              ref={markerRef}
              coordinate={{
                latitude: selectedPlace.geometry.location.lat,
                longitude: selectedPlace.geometry.location.lng,
              }}>
              <Callout>
                <View style={styles.calloutContainer}>
                  <Text style={styles.callOutTitle}>{selectedPlace?.name}</Text>
                  <Text style={styles.callOutAddress}>
                    {selectedPlace?.formatted_address}
                  </Text>
                </View>
              </Callout>
            </Marker>
          )}
        </MapView>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <Text style={styles.zoomText}>-</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{...styles.historyContainer, maxHeight: 250}}>
        <Text style={styles.historyTitle}>Search History</Text>
        {searchHistory.length > 0 ? (
          <FlatList
            data={searchHistory}
            keyExtractor={item => item.place_id}
            renderItem={({item}) => (
              <TouchableOpacity
                onPress={() => handleHistorySelect(item)}
                style={[
                  styles.historyItem,
                  selectedPlace?.place_id === item.place_id &&
                    styles.selectedHistory,
                ]}>
                <Text style={styles.historyItemName}>{item.name}</Text>
                <Text style={styles.historyItemAddress}>
                  {item.formatted_address}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <Text>No search history yet.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  calloutContainer: {
    flex: 1, // Ensure the container takes up space
    alignItems: 'center', // Center horizontally
    justifyContent: 'center', // Center vertically (if needed)
  },
  callOutTitle: {
    textAlign: 'center',
    fontWeight: 'bold',
  },
  callOutAddress: {
    textAlign: 'center',
  },
  selectedHistory: {
    backgroundColor: 'rgb(239, 239, 240)',
  },
  searchContainer: {
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  searchInput: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: 'white',
    color: '#000',
  },
  searchResultsList: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    maxHeight: 150,
    color: '#000000',
  },
  searchItem: {
    color: '#000000',
  },
  searchResultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  map: {
    flex: 2,
    width: '100%',
    height: '100%',
  },
  historyContainer: {
    padding: 10,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  historyItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyItemName: {
    fontWeight: 'bold',
  },
  historyItemAddress: {
    color: 'gray',
    fontSize: 12,
  },
  zoomControls: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'column',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 5,
    padding: 5,
  },
  zoomButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 2, // Or however much space you want the map to take
    position: 'relative', // Needed for absolute positioning of children
  },
});

export default App;
