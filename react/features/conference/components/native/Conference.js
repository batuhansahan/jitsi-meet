// @flow

import React from 'react';
import { NativeModules, SafeAreaView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { appNavigate } from '../../../app/actions';
import { PIP_ENABLED, getFeatureFlag } from '../../../base/flags';
import { Container, LoadingIndicator, TintedView } from '../../../base/react';
import { getConferenceName } from '../../../base/conference';
import { connect } from '../../../base/redux';
import { ASPECT_RATIO_NARROW } from '../../../base/responsive-ui/constants';
import { TestConnectionInfo } from '../../../base/testing';
import { ConferenceNotification, isCalendarEnabled } from '../../../calendar-sync';
import { DisplayNameLabel } from '../../../display-name';
import { SharedDocument } from '../../../etherpad';
import {
    FILMSTRIP_SIZE,
    Filmstrip,
    isFilmstripVisible,
    TileView
} from '../../../filmstrip';
import { AddPeopleDialog, CalleeInfoContainer } from '../../../invite';
import { LargeVideo } from '../../../large-video';
import { KnockingParticipantList } from '../../../lobby';
import { BackButtonRegistry } from '../../../mobile/back-button';
import { Captions } from '../../../subtitles';
import { setToolboxVisible } from '../../../toolbox/actions';
import { Toolbox } from '../../../toolbox/components/native';
import { isToolboxVisible } from '../../../toolbox/functions';
import {
    AbstractConference,
    abstractMapStateToProps
} from '../AbstractConference';
import type { AbstractProps } from '../AbstractConference';

import Labels from './Labels';
import LonelyMeetingExperience from './LonelyMeetingExperience';
import NavigationBar from './NavigationBar';
import styles, { NAVBAR_GRADIENT_COLORS } from './styles';


/**
 * The type of the React {@code Component} props of {@link Conference}.
 */
type Props = AbstractProps & {

    /**
     * Application's aspect ratio.
     */
    _aspectRatio: Symbol,

    /**
     * Wherther the calendar feature is enabled or not.
     */
    _calendarEnabled: boolean,

    /**
     * The indicator which determines that we are still connecting to the
     * conference which includes establishing the XMPP connection and then
     * joining the room. If truthy, then an activity/loading indicator will be
     * rendered.
     */
    _connecting: boolean,

    /**
     * Set to {@code true} when the filmstrip is currently visible.
     */
    _filmstripVisible: boolean,

    /**
     * The ID of the participant currently on stage (if any)
     */
    _largeVideoParticipantId: string,

    /**
     * Whether Picture-in-Picture is enabled.
     */
    _pictureInPictureEnabled: boolean,


    /**
     * 
     */

    _toolboxEnabled: boolean,


    /**
     * The indicator which determines whether the UI is reduced (to accommodate
     * smaller display areas).
     */
    _reducedUI: boolean,

    /**
     * The indicator which determines whether the Toolbox is visible.
     */
    _toolboxVisible: boolean,

    /**
     * The redux {@code dispatch} function.
     */
    dispatch: Function
};

/**
 * The conference page of the mobile (i.e. React Native) application.
 */
class Conference extends AbstractConference<Props, *> {
    /**
     * Initializes a new Conference instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props) {
        super(props);

        // Bind event handlers so they are only bound once per instance.
        this._onClick = this._onClick.bind(this);
        this._onHardwareBackPress = this._onHardwareBackPress.bind(this);
        this._setToolboxVisible = this._setToolboxVisible.bind(this);
    }

    /**
     * Implements {@link Component#componentDidMount()}. Invoked immediately
     * after this component is mounted.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentDidMount() {
        BackButtonRegistry.addListener(this._onHardwareBackPress);
    }

    /**
     * Implements {@link Component#componentWillUnmount()}. Invoked immediately
     * before this component is unmounted and destroyed. Disconnects the
     * conference described by the redux store/state.
     *
     * @inheritdoc
     * @returns {void}
     */
    componentWillUnmount() {
        // Tear handling any hardware button presses for back navigation down.
        BackButtonRegistry.removeListener(this._onHardwareBackPress);
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        return (
            <Container style = { styles.conference }>
                { this._renderContent() }
            </Container>
        );
    }

    _onClick: () => void;

    /**
     * Changes the value of the toolboxVisible state, thus allowing us to switch
     * between Toolbox and Filmstrip and change their visibility.
     *
     * @private
     * @returns {void}
     */
    _onClick() {
        this._setToolboxVisible(!this.props._toolboxVisible);
    }

    _onHardwareBackPress: () => boolean;

    /**
     * Handles a hardware button press for back navigation. Enters Picture-in-Picture mode
     * (if supported) or leaves the associated {@code Conference} otherwise.
     *
     * @returns {boolean} Exiting the app is undesired, so {@code true} is always returned.
     */
    _onHardwareBackPress() {
        let p;

        if (this.props._pictureInPictureEnabled) {
            const { PictureInPicture } = NativeModules;

            p = PictureInPicture.enterPictureInPicture();
        } else {
            p = Promise.reject(new Error('PiP not enabled'));
        }

        p.catch(() => {
            this.props.dispatch(appNavigate(undefined));
        });

        return true;
    }

    /**
     * Renders JitsiModals that are supposed to be on the conference screen.
     *
     * @returns {Array<ReactElement>}
     */
    _renderConferenceModals() {
        return [
        ];
    }


    /**
     * Renders the content for the Conference container.
     *
     * @private
     * @returns {React$Element}
     */
    _renderContent() {
        const {
            _aspectRatio,
            _connecting,
            _filmstripVisible,
            _largeVideoParticipantId,
            _reducedUI,
            _shouldDisplayTileView,
            _toolboxVisible,
            _toolboxEnabled
        } = this.props;
        const showGradient = _toolboxVisible;
        const applyGradientStretching
            = _filmstripVisible && _aspectRatio === ASPECT_RATIO_NARROW && !_shouldDisplayTileView;

        if (_reducedUI) {
            return this._renderContentForReducedUi();
        }

        return (
            <>
                {/*
                  * The LargeVideo is the lowermost stacking layer.
                  */_toolboxEnabled ? _shouldDisplayTileView
                            ? <TileView onClick = { this._onClick } />
                            : <LargeVideo whiteback={false} onClick = { this._onClick } /> :
                  <LargeVideo whiteback={true} onClick = { this._onClick } /> 
                        
                }
                {/*
                  * The activity/loading indicator goes above everything, except
                  * the toolbox/toolbars and the dialogs.
                  */
                    _toolboxEnabled && _connecting
                        && <TintedView>
                            <LoadingIndicator />
                        </TintedView>
                }

                <SafeAreaView
                    pointerEvents = 'box-none'
                    style = { styles.toolboxAndFilmstripContainer }>

                    { _shouldDisplayTileView || _toolboxEnabled && <DisplayNameLabel participantId = { _largeVideoParticipantId } /> }

                    {/*
                      * The Toolbox is in a stacking layer below the Filmstrip.
                      */}
                    {_toolboxEnabled && <Toolbox />}

                    {/*
                      * The Filmstrip is in a stacking layer above the
                      * LargeVideo. The LargeVideo and the Filmstrip form what
                      * the Web/React app calls "videospace". Presumably, the
                      * name and grouping stem from the fact that these two
                      * React Components depict the videos of the conference's
                      * participants.
                      */
                        _shouldDisplayTileView ? undefined : _toolboxEnabled && <Filmstrip />
                    }
                </SafeAreaView>
            </>
        );
    }

    /**
     * Renders the content for the Conference container when in "reduced UI" mode.
     *
     * @private
     * @returns {React$Element}
     */
    _renderContentForReducedUi() {
        const { _connecting } = this.props;

        return (
            <>
                <LargeVideo onClick = { this._onClick } />

                {
                    _connecting
                        && <TintedView>
                            <LoadingIndicator />
                        </TintedView>
                }
            </>
        );
    }

    _setToolboxVisible: (boolean) => void;

    /**
     * Dispatches an action changing the visibility of the {@link Toolbox}.
     *
     * @private
     * @param {boolean} visible - Pass {@code true} to show the
     * {@code Toolbox} or {@code false} to hide it.
     * @returns {void}
     */
    _setToolboxVisible(visible) {
        this.props.dispatch(setToolboxVisible(visible));
    }
}

/**
 * Maps (parts of) the redux state to the associated {@code Conference}'s props.
 *
 * @param {Object} state - The redux state.
 * @private
 * @returns {Props}
 */
function _mapStateToProps(state) {
    const { connecting, connection } = state['features/base/connection'];
    const {
        conference,
        joining,
        membersOnly,
        leaving
    } = state['features/base/conference'];
    const { aspectRatio, reducedUI } = state['features/base/responsive-ui'];

    // XXX There is a window of time between the successful establishment of the
    // XMPP connection and the subsequent commencement of joining the MUC during
    // which the app does not appear to be doing anything according to the redux
    // state. In order to not toggle the _connecting props during the window of
    // time in question, define _connecting as follows:
    // - the XMPP connection is connecting, or
    // - the XMPP connection is connected and the conference is joining, or
    // - the XMPP connection is connected and we have no conference yet, nor we
    //   are leaving one.
    const connecting_
        = connecting || (connection && (!membersOnly && (joining || (!conference && !leaving))));

    return {
        ...abstractMapStateToProps(state),
        _aspectRatio: aspectRatio,
        _calendarEnabled: isCalendarEnabled(state),
        _connecting: Boolean(connecting_),
        _filmstripVisible: isFilmstripVisible(state),
        _largeVideoParticipantId: state['features/large-video'].participantId,
        _pictureInPictureEnabled: getFeatureFlag(state, PIP_ENABLED),

        
        /**
         * Whether Toolbox is enabled.
         *
         * @private
         * @type {boolean}
         */
        _toolboxEnabled: getConferenceName(state) === 'toolbox_disabled' ? false : true,
        // getFeatureFlag(state, "toolbox.enabled"),

        /**
         * The indicator which determines whether the UI is reduced (to
         * accommodate smaller display areas).
         *
         * @private
         * @type {boolean}
         */
        _reducedUI: reducedUI,
        _toolboxVisible: isToolboxVisible(state)
    };
}

export default connect(_mapStateToProps)(Conference);
