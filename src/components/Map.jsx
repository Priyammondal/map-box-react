import React, { useRef, useEffect, useState, useContext } from "react";
import "./Map.scss";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import axios from "axios";
import MapboxGeocoding from "@mapbox/mapbox-sdk/services/geocoding";
import { FaArrowsAltV } from "react-icons/fa";
import { MdLocationOn } from "react-icons/md";
import { AiFillHome } from "react-icons/ai";

const Direction = () => {
  const mapContainerRef = useRef(null);
  const [mapStyle, setMapStyle] = useState(
    "mapbox://styles/mapbox/streets-v11"
  );
  const [isFocused, setIsFocused] = useState(false);
  const [origin, setOrigin] = useState("");
  const destination = [88.3639, 22.5726];
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [originCord, setOriginCord] = useState([]);
  let originCoordinates = [];
  const [routeInfo, setRouteInfo] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const [expand, setExpand] = useState(false);
  const initialItemCount = 4;
  const directions = routeInfo.length > 0 ? routeInfo[0].legs[0].steps : [];
  const displayedDirections = expand
    ? directions
    : directions.slice(0, initialItemCount);

  const handleToggleExpand = () => {
    setExpand(!expand);
  };

  const geocodingClient = MapboxGeocoding({
    accessToken: import.meta.env.VITE_MAP_BOX_ACCESS_TOKEN,
  });

  console.log("routeInfo==>", routeInfo);

  useEffect(() => {
    localStorage.setItem("mode", "driving");
  }, []);

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAP_BOX_ACCESS_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [88.3639, 22.5726], // longitude and latitude
      zoom: 12,
      attributionControl: false,
    });

    map.on("style.load", () => {
      // Add the compass control
      const compassControl = new mapboxgl.NavigationControl({
        showCompass: true,
      });
      map.addControl(compassControl, "top-right");

      // Create a marker with a custom icon
      const marker = new mapboxgl.Marker({
        element: document.getElementById("custom-marker"),
      })
        .setLngLat([88.3639, 22.5726]) // longitude and latitude
        .addTo(map)
        .setPopup(
          new mapboxgl.Popup({ closeButton: true }).setHTML(
            `
          <div class="location-details">
            <span><strong>City:</strong> Kolkata</span><br>
            <span><strong>State:</strong> West Bengal</span><br>
            <span><strong>Country:</strong> INDIA</span></div>
          </div>
          `
          )
        );

      // Create a marker at the starting position
      const startMarker = new mapboxgl.Marker()
        .setLngLat(originCord)
        .addTo(map);

      if (routeGeometry) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: routeGeometry,
          },
        });

        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3b9ddd",
            "line-width": 6,
          },
        });
      }
      // Get the route bounds
      const bounds = routeGeometry.coordinates.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds()
      );

      // Zoom out to fit the route within the map view
      map.fitBounds(bounds, {
        padding: 50,
      });
    });

    // return () => {
    //   map.remove();
    // };
  }, [mapStyle, routeGeometry]);

  const handleMapStyleChange = (event) => {
    setMapStyle(event.target.value);
  };

  const handleInputChange = (event) => {
    const { value } = event.target;
    setOrigin(value);

    // Call the autocomplete API to get suggestions
    axios
      .get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${value}.json`, {
        params: {
          access_token: mapboxgl.accessToken,
          autocomplete: true,
          types: ["place"],
          limit: 5,
        },
      })
      .then((response) => {
        const { features } = response.data;
        setSuggestions(features);
      })
      .catch((error) => {
        console.error("Error fetching autocomplete suggestions:", error);
      });
  };

  const handleSelectSuggestion = (suggestion) => {
    setOrigin(suggestion.place_name);
    setOriginCord(suggestion.center);
    setSuggestions([]); // Clear the suggestions
  };

  // calculate direction
  const calcRouteDirection = async () => {
    if (origin.length > 2) {
      try {
        const origin = document.getElementById("fromAddress").value;
        if (origin.length > 2) {
          try {
            const response = await geocodingClient
              .forwardGeocode({
                query: origin,
                types: ["place"],
                limit: 1,
              })
              .send();

            const destinationCoordinates = response.body.features[0].center;
            originCoordinates = destinationCoordinates;
            setOriginCord(destinationCoordinates);
          } catch (error) {
            console.error("Error calculating directions:", error);
            throw error;
          }
        }
        const response = await axios.get(
          `https://api.mapbox.com/directions/v5/mapbox/${localStorage.getItem(
            "mode"
          )}/${originCoordinates[0]},${originCoordinates[1]};${
            destination[0]
          },${destination[1]}?steps=true&geometries=geojson&access_token=${
            import.meta.env.VITE_MAP_BOX_ACCESS_TOKEN
          }`
        );

        const routes = response.data.routes;
        console.log("routes=>", routes);
        setRouteInfo(routes);
        // Check if any routes are returned
        if (routes.length > 0) {
          const { distance, duration, geometry } = routes[0];

          // Valid directions, use the distance and duration for further processing
          const directions = {
            distance,
            duration,
          };
          localStorage.setItem("fromLocation", origin);
          setRouteGeometry(geometry); // Set the route geometry
          return directions;
        } else {
          // No routes found
          throw new Error("Unable to calculate directions");
        }
      } catch (error) {
        // Handle error
        console.error("Error calculating directions:", error);
        throw error;
      }
    }
  };

  const handleInputBlur = () => {
    // Use setTimeout to allow the click event to be registered before clearing suggestions
    setTimeout(() => {
      setIsFocused(false);
      setSuggestions([]);
    }, 200);
  };

  console.log("routeGeometry==>", routeGeometry);

  return (
    <div className="container direction">
      <div className="col-lg-12 col-sm-12 text-center MT30">
        <h1 className="primary-title text-center" id="info">
          Map and Directions to Kolkata, West Bengal, India
        </h1>
      </div>

      <div className="F18 MB15">
        <div className="col-lg-12 map_to_box col-xs-12 col-sm-12 text-xs-center text-center">
          <div id="from" className="mx-auto">
            <strong>From</strong>
            <label htmlFor="fromAddress" style={{ display: "none" }}>
              From label
            </label>
            <input
              type="text"
              className={isFocused ? "input-focused" : ""}
              name="fromAddress"
              id="fromAddress"
              placeholder="Example: 10 Market Street, San Francisco, CA 94105"
              value={origin}
              onChange={(e) => {
                handleInputChange(e);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={handleInputBlur}
              autoComplete="off"
            />
          </div>
          {isFocused && suggestions.length > 0 && (
            <div className="suggestions mx-auto text-start">
              {suggestions.map((suggestion) => (
                <div
                  className="suggestion-item"
                  key={suggestion.id}
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  {suggestion.place_name}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* <div ref={mapContainerRef} className="map-container" /> */}

        <div className="col-lg-12 map_trans col-xs-12 col-sm-12  text-xs-center text-center">
          <a
            className={
              localStorage.getItem("mode") === "driving"
                ? `car car_active`
                : `car`
            }
            title="Driving"
            id="DRIVING"
            onClick={() => {
              localStorage.setItem("mode", "driving");
              calcRouteDirection();
            }}
          >
            <span className="hide">Car Driving Directions</span>
          </a>
          <a
            className={
              localStorage.getItem("mode") === "walking"
                ? `walk walk_active`
                : `walk`
            }
            title="Walking"
            id="WALKING"
            onClick={() => {
              localStorage.setItem("mode", "walking");
              calcRouteDirection();
            }}
          >
            <span className="hide">Walking Directions</span>
          </a>
          <a
            className={
              localStorage.getItem("mode") === "cycling"
                ? `cycle cycle_active`
                : `cycle`
            }
            title="Bicycling"
            id="BICYCLING"
            onClick={() => {
              localStorage.setItem("mode", "cycling");
              calcRouteDirection();
            }}
          >
            <span className="hide">Bicycling Directions</span>
          </a>

          <input id="modeType" type="hidden" value="" />
        </div>

        <div className="col-lg-12 col-xs-12 PT5 col-sm-12 text-xs-center PB10 notranslate text-center">
          <div className="book_btn">
            <input
              onClick={() => calcRouteDirection()}
              type="button"
              className="btns btn-green"
              value="Get Directions"
            />
          </div>
        </div>

        {routeInfo.length > 0 && (
          <div className="col-12 row mt-5 mx-auto">
            <div
              className="col-lg-6 col-md-6 col-sm-6 col-xs-12 text-center mobile-shadow"
              id="direction_div_show"
            >
              <h2 className="M10 F25">
                <MdLocationOn className="MR10 F30" />
                <span id="from_address_show">
                  {localStorage
                    .getItem("fromLocation")
                    .replace(/\b\w/g, (match) => match.toUpperCase())}
                </span>
                <span className="hide">from location</span>
              </h2>
              <FaArrowsAltV className="F82 between-arrow" />
              <h2 className="M10 F25">
                <AiFillHome className="MR10 F30" />
                <span id="to_address_show">Kolkata, West Bengal, India</span>
                <span className="hide">to location</span>
              </h2>
            </div>
            <div
              id="bor_left"
              className="col-lg-6 col-md-6 col-sm-6 initialdhide MB20 mt-4 mt-md-0 mobile-shadow"
              style={{ display: "block", minHeight: "198px" }}
            >
              <span className="duration">
                Trip duration:{" "}
                {routeInfo.length > 0 && Math.floor(routeInfo[0].duration / 60)}{" "}
                mins for{" "}
                {routeInfo.length > 0 && routeInfo[0].weight_name === "auto"
                  ? "Driving"
                  : routeInfo.length > 0 &&
                    routeInfo[0].weight_name === "pedestrian"
                  ? "Walking"
                  : routeInfo.length > 0 &&
                    routeInfo[0].weight_name === "cyclability"
                  ? "Cycling"
                  : null}
              </span>
              <br /> <br />
              <ul className={`directions-list ${expand ? "expanded" : ""}`}>
                {displayedDirections.map((item) => (
                  <li className="pb-2">{item.maneuver.instruction}</li>
                ))}
              </ul>
              <br />
              <div className="moreDirection">
                {!expand && (
                  <button
                    className="moreDirection__btn"
                    id="showMoreDirection"
                    title="View More"
                    onClick={handleToggleExpand}
                  >
                    View More
                  </button>
                )}
                {expand && (
                  <button
                    className="moreDirection__btn"
                    id="showLessDirection"
                    title="View Less"
                    onClick={handleToggleExpand}
                  >
                    View Less
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="col-lg-12 map_trans col-xs-12 col-sm-12  text-xs-center text-center">
        <div
          ref={mapContainerRef}
          style={{
            width: "100%",
            height: "70vh",
            border: "1px solid",
            marginBottom: "3rem",
          }}
        />
        <select
          className="map-style-dropdown"
          value={mapStyle}
          onChange={handleMapStyleChange}
          id="map_type"
        >
          <option value="mapbox://styles/mapbox/streets-v11">MAP</option>
          <option value="mapbox://styles/mapbox/satellite-v9">SATELLITE</option>
        </select>
      </div>
      <div
        id="custom-marker"
        className="mapboxgl-marker mapboxgl-marker-anchor-center"
        tabIndex="0"
      ></div>
    </div>
  );
};

export default Direction;
