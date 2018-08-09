/**
 * @format
 * @flow
 */

import React from 'react';
import { Platform, Switch, Text, View, FlatList, TextInput, KeyboardAvoidingView } from 'react-native';
import RecyclerViewList, { DataSource } from 'react-native-recyclerview-list';
import BlockHolder from './block-holder';
import { ToolbarButton } from './constants';

import type { BlockType } from '../store/';

import styles from './block-manager.scss';

// Gutenberg imports
import { getBlockType, serialize } from '@wordpress/blocks';

export type BlockListType = {
	onChange: ( uid: string, attributes: mixed ) => void,
	focusBlockAction: string => mixed,
	moveBlockUpAction: string => mixed,
	moveBlockDownAction: string => mixed,
	deleteBlockAction: string => mixed,
	parseBlocksAction: string => mixed => mixed,
	blocks: Array<BlockType>,
	aztechtml: string,
	refresh: boolean,
	parser: mixed,
};

type PropsType = BlockListType;
type StateType = {
	dataSource: DataSource,
	showHtml: boolean
};

export default class BlockManager extends React.Component<PropsType, StateType> {
	_recycler = null;

	constructor( props: PropsType ) {
		super( props );
		this.html = '';
		this.state = {
			dataSource: new DataSource( this.props.blocks, ( item: BlockType ) => item.uid ),
			showHtml: false,
		};
	}

	componentDidMount() {
		this.serializeToHtml();
	}

	onBlockHolderPressed( uid: string ) {
		this.props.focusBlockAction( uid );
	}

	getDataSourceIndexFromUid( uid: string ) {
		for ( let i = 0; i < this.state.dataSource.size(); ++i ) {
			const block = this.state.dataSource.get( i );
			if ( block.uid === uid ) {
				return i;
			}
		}
		return -1;
	}

	onToolbarButtonPressed( button: number, uid: string ) {
		const dataSourceBlockIndex = this.getDataSourceIndexFromUid( uid );
		switch ( button ) {
			case ToolbarButton.UP:
				this.state.dataSource.moveUp( dataSourceBlockIndex );
				this.props.moveBlockUpAction( uid );
				break;
			case ToolbarButton.DOWN:
				this.state.dataSource.moveDown( dataSourceBlockIndex );
				this.props.moveBlockDownAction( uid );
				break;
			case ToolbarButton.DELETE:
				this.state.dataSource.splice( dataSourceBlockIndex, 1 );
				this.props.deleteBlockAction( uid );
				break;
			case ToolbarButton.SETTINGS:
				// TODO: implement settings
				break;
		}
	}

	serializeToHtml() {
		return this.props.blocks
			.map( ( block ) => {
				const blockType = getBlockType( block.name );
				if ( blockType ) {
					return serialize( [ block ] ) + '\n\n';
				} else if ( block.name === 'aztec' ) {
					return '<aztec>' + block.attributes.content + '</aztec>\n\n';
				}

				return '<span>' + block.attributes.content + '</span>\n\n';
			} )
			.reduce( ( prevVal, value ) => {
				return prevVal + value;
			}, '' );
	}

	parseHTML() {
		const {
			parser,
			parseBlocksAction,
		} = this.props;

		parseBlocksAction( this.html, parser );
	}

	componentDidUpdate() {
		// List has been updated, tell the recycler view to update the view
		this.state.dataSource.setDirty();
	}

	onChange( uid: string, attributes: mixed ) {
		// Update datasource UI
		const index = this.getDataSourceIndexFromUid( uid );
		const dataSource = this.state.dataSource;
		const block = dataSource.get( this.getDataSourceIndexFromUid( uid ) );
		dataSource.set( index, { ...block, attributes: attributes } );
		// Update Redux store
		this.props.onChange( uid, attributes );
	}

	render() {
		let list;
		if ( Platform.OS === 'android' ) {
			list = (
				<RecyclerViewList
					ref={ ( component ) => ( this._recycler = component ) }
					style={ styles.list }
					dataSource={ this.state.dataSource }
					renderItem={ this.renderItem.bind( this ) }
					ListEmptyComponent={
						<View style={ { borderColor: '#e7e7e7', borderWidth: 10, margin: 10, padding: 20 } }>
							<Text style={ { fontSize: 15 } }>No blocks :(</Text>
						</View>
					}
				/>
			);
		} else {
			// TODO: we won't need this. This just a temporary solution until we implement the RecyclerViewList native code for iOS
			list = (
				<FlatList
					style={ styles.list }
					data={ this.props.blocks }
					extraData={ this.props.refresh }
					keyExtractor={ ( item ) => item.uid }
					renderItem={ this.renderItem.bind( this ) }
				/>
			);
		}

		return (
			<View style={ styles.container }>
				<View style={ { height: 30 } } />
				<View style={ styles.switch }>
					<Text>View html output</Text>
					<Switch
						activeText={ 'On' }
						inActiveText={ 'Off' }
						value={ this.state.showHtml }
						onValueChange={ ( value ) => {
							if ( value ) {
								this.html = this.serializeToHtml();
							} else {
								this.parseHTML();
							}

							this.setState( { showHtml: value } );
						} }
					/>
				</View>
				{ this.state.showHtml && this.renderHTML() }
				{ ! this.state.showHtml && list }
			</View>
		);
	}

	renderItem( value: { item: BlockType, uid: string } ) {
		return (
			<BlockHolder
				onToolbarButtonPressed={ this.onToolbarButtonPressed.bind( this ) }
				onBlockHolderPressed={ this.onBlockHolderPressed.bind( this ) }
				onChange={ this.onChange.bind( this ) }
				focused={ value.item.focused }
				uid={ value.uid }
				{ ...value.item }
			/>
		);
	}

	renderHTML() {
		const behavior = Platform.OS === 'ios' ? 'padding' : null;
		return (
			<KeyboardAvoidingView style={ { flex: 1 } } behavior={ behavior }>
				<TextInput
					multiline
					numberOfLines={ 0 }
					style={ styles.htmlView }
					onChangeText={ ( html ) => this.html = html }>
					{ this.html }
				</TextInput>
			</KeyboardAvoidingView>
		);
	}
}
